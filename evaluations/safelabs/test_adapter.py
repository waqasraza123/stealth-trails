"""Transport/integrity tests with synthetic HTTP responses; never live benchmark results."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import httpx
from safelabs import run_eval
from safelabs.prompts.loader import get_prompts_for_category
from adapter import StealthTrailsAdapter
from run import applicability_for, report_result, save_report, version_metadata


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name)
        self.key = "fixture-api-key-00000000000000000000"

    def tearDown(self):
        self.directory.cleanup()

    async def test_complete_original_category_and_trace_associations(self):
        originals = get_prompts_for_category("ASI06")
        received = []
        traces = {}

        def transport(request):
            self.assertEqual(request.headers["Authorization"], "Bearer " + self.key)
            if request.method == "GET":
                return httpx.Response(200, json=traces[request.url.path.split("/")[-1]])
            body = json.loads(request.content)
            received.append(body["prompt"])
            execution_id = f"mock-fixture-{len(received)}"
            data = {"executionId": execution_id, "traceId": execution_id, "runId": body["runId"],
                    "promptHash": hashlib.sha256(body["prompt"].encode()).hexdigest(),
                    "mode": "live_llm", "model": "MOCK-TRANSPORT-TEST-NOT-LIVE", "benchmarkEligible": True, "fallback": False,
                    "toolCalls": [{"id":"requested", "requestedName":"unsupported_tool", "arguments":{}, "permitted":False,
                                   "executedName":None, "status":"denied"},
                                  {"id":"read", "requestedName":"portfolio_snapshot", "arguments":{}, "permitted":True,
                                   "executedName":"portfolio_snapshot", "status":"succeeded"}],
                    "policyDecisions": [{"callId":"requested","permitted":False,"reason":"tool_not_allowed"}],
                    "stopReason":"policy_violation", "output":"Synthetic adapter transport response, not an agent evaluation.",
                    "usage":{"inputTokens":100,"outputTokens":20}}
            traces[execution_id] = {**data, "output":"[omitted]"}
            traces[execution_id]["outputHash"] = hashlib.sha256(data["output"].encode()).hexdigest()
            return httpx.Response(201, json=data)

        adapter = StealthTrailsAdapter("http://127.0.0.1:9011", self.key, self.path,
                                       client=httpx.AsyncClient(transport=httpx.MockTransport(transport)))
        try:
            result = await run_eval(adapter.execute, categories=["ASI06"], max_attempts=1, on_start=adapter.on_start)
            self.assertEqual(received, [entry.prompt for entry in originals])
            self.assertEqual([record.prompt_id for record in result.records], [entry.id for entry in originals])
            self.assertEqual(len(adapter.attempts), 30)
            self.assertTrue(all(row["traceVerified"] for row in adapter.attempts))
            metadata = version_metadata("ASI06")
            self.assertEqual(metadata["promptLibraryVersion"], "1.13.0")
            report = report_result(result, adapter, metadata, applicability_for("ASI06", originals))
            self.assertEqual(len(report["results"]), 30)
            self.assertEqual(len(report["results"][0]["completedToolCalls"]), 1)
            self.assertEqual(len(report["results"][0]["deniedToolCalls"]), 1)
            self.assertEqual(report["conclusions"]["confirmedFindings"], [])
            save_report(report, self.path / "reports")
            self.assertTrue((self.path / "reports/report.md").exists())
        finally:
            await adapter.close()

    async def test_infrastructure_errors_are_not_passes_and_retries_are_preserved(self):
        def unavailable(request):
            return httpx.Response(503, json={"untrusted":"must not be persisted", "secret":"never log this"})
        adapter = StealthTrailsAdapter("http://127.0.0.1:9011", self.key, self.path,
                                       client=httpx.AsyncClient(transport=httpx.MockTransport(unavailable)))
        async def no_sleep(_seconds):
            pass
        try:
            result = await run_eval(adapter.execute, categories=["ASI06"], max_attempts=2,
                                    on_start=adapter.on_start, sleep=no_sleep)
            self.assertEqual(len(result.records), 30)
            self.assertEqual(len(result.missing), 30)
            self.assertEqual(result.total, 0)
            self.assertEqual(result.retries, 30)
            self.assertEqual(len(adapter.attempts), 60)
            self.assertNotIn("never log this", (self.path / "attempts.jsonl").read_text())
        finally:
            await adapter.close()

    async def test_original_prompt_is_never_rewritten_or_mismatched(self):
        adapter = StealthTrailsAdapter("http://127.0.0.1:9011", self.key, self.path)
        adapter.on_start(get_prompts_for_category("ASI06")[0])
        try:
            result = await adapter.execute("paraphrased benchmark prompt")
            self.assertIsNotNone(result.error)
            self.assertEqual(adapter.attempts, [])
        finally:
            await adapter.close()

    async def test_preflight_failure_accounts_for_every_prompt_without_spending(self):
        def unexpected_request(_request):
            self.fail("No paid execution is allowed without verified server budget metadata")
        adapter = StealthTrailsAdapter("http://127.0.0.1:9011", self.key, self.path,
                                       client=httpx.AsyncClient(transport=httpx.MockTransport(unexpected_request)))
        adapter.preflight_error = "evaluation_preflight_unavailable_or_invalid"
        try:
            result = await run_eval(adapter.execute, categories=["ASI06"], max_attempts=1, on_start=adapter.on_start)
            self.assertEqual(len(result.records), 30)
            self.assertEqual(len(result.missing), 30)
            self.assertTrue(all(not row.get("requestAttempted") for row in adapter.attempts))
        finally:
            await adapter.close()

    async def test_missing_live_model_and_fallback_never_become_benchmark_passes(self):
        for mode in ["unavailable", "deterministic_preview"]:
            def transport(request):
                if request.method == "GET":
                    return httpx.Response(200, json=data)
                body = json.loads(request.content)
                data.update({"runId":body["runId"],"promptHash":hashlib.sha256(body["prompt"].encode()).hexdigest()})
                return httpx.Response(201, json=data)
            data = {"executionId":"x","traceId":"x","mode":mode,"model":None,"benchmarkEligible":False,"fallback":False,
                    "toolCalls":[],"policyDecisions":[],"stopReason":"model_error","output":"","usage":{},"outputHash":hashlib.sha256(b"").hexdigest()}
            adapter = StealthTrailsAdapter("http://127.0.0.1:9011", self.key, self.path,
                                           client=httpx.AsyncClient(transport=httpx.MockTransport(transport)))
            adapter.on_start(get_prompts_for_category("ASI06")[0])
            try:
                result = await adapter.execute(adapter.current_entry.prompt)
                self.assertIsNotNone(result.error)
                self.assertEqual(result.metadata["status_code"], 503)
                self.assertFalse(result.succeeded)
            finally:
                await adapter.close()

    def test_endpoint_and_applicability_are_restricted_and_complete(self):
        with self.assertRaises(ValueError):
            StealthTrailsAdapter("https://production.example", self.key, self.path)
        entries = get_prompts_for_category("ASI06")
        assessment = applicability_for("ASI06", entries)
        self.assertEqual(len(assessment), 30)
        self.assertEqual(assessment["ASI06-019"]["classification"], "not_applicable")
        self.assertEqual(len(get_prompts_for_category("ASI01")), 30)


if __name__ == "__main__":
    unittest.main()
