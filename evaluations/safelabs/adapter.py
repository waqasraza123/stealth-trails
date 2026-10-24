"""SafeLabs transport for the actual identity-bound NestJS research runtime."""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from safelabs.agents.base import AgentAdapter
from safelabs.agents.schemas import AgentResponse, ToolCall, normalize_usage

SAFELABS_COMMIT = "1df3ea043353fc38535b03e375d0becf1f343b8d"


class StealthTrailsAdapter(AgentAdapter):
    def __init__(self, endpoint: str, api_key: str, artifacts: Path, *, timeout: float = 140,
                 max_attempts: int = 60, client: httpx.AsyncClient | None = None):
        super().__init__(timeout=timeout)
        url = urlparse(endpoint)
        if url.scheme != "http" or url.hostname not in {"localhost", "127.0.0.1", "::1"} or url.username or url.password or url.query or url.fragment or url.path not in {"", "/"}:
            raise ValueError("Only a loopback evaluation server base URL is allowed")
        if len(api_key) < 32:
            raise ValueError("A separate evaluation API key is required")
        self.endpoint = endpoint.rstrip("/") + "/internal/ai-agent-evaluation"
        self.client = client or httpx.AsyncClient(timeout=timeout - 1, trust_env=False, follow_redirects=False)
        self.api_key = api_key
        self.artifacts = artifacts
        artifacts.mkdir(parents=True, exist_ok=True)
        self.suite_id = uuid.uuid4().hex[:16]
        self.current_entry = None
        self.attempts: list[dict] = []
        self.max_attempts = max_attempts
        self.preflight_error: str | None = None

    @property
    def adapter_type(self) -> str:
        return "stealth_trails_langgraph"

    def on_start(self, entry) -> None:
        self.current_entry = entry

    async def _execute(self, prompt: str) -> AgentResponse:
        if self.current_entry is None or self.current_entry.prompt != prompt:
            raise ValueError("Original prompt and prompt ID association required")
        prompt_id = self.current_entry.id
        number = sum(row["promptId"] == prompt_id for row in self.attempts) + 1
        run_id = f"{self.suite_id}.{prompt_id}.{number}"
        record = {"promptId": prompt_id, "attempt": number, "runId": run_id,
                  "promptHash": hashlib.sha256(prompt.encode()).hexdigest(), "executionId": None}
        started = time.perf_counter()
        try:
            if self.preflight_error:
                record["error"] = self.preflight_error
                return AgentResponse(output="", error=self.preflight_error, metadata={"status_code":503})
            if len(self.attempts) >= self.max_attempts:
                record["error"] = "configured_evaluation_attempt_budget_exhausted"
                return AgentResponse(output="", error=record["error"], metadata={"status_code": 503})
            record["requestAttempted"] = True
            response = await self.client.post(self.endpoint + "/execute", headers={"Authorization": f"Bearer {self.api_key}"},
                                              json={"prompt": prompt, "runId": run_id})
            if response.status_code >= 400:
                record["statusCode"] = response.status_code
                # Never persist arbitrary HTML/error responses, headers or credentials.
                return AgentResponse(output="", error=f"evaluation_http_{response.status_code}",
                                     latency_ms=(time.perf_counter() - started) * 1000,
                                     metadata={"status_code": response.status_code})
            response.raise_for_status()
            data = response.json()
            required = {"executionId", "traceId", "runId", "mode", "benchmarkEligible", "toolCalls", "policyDecisions", "stopReason", "output", "usage", "promptHash", "model"}
            if not required.issubset(data) or data["runId"] != run_id or data["promptHash"] != record["promptHash"] or data["traceId"] != data["executionId"]:
                raise ValueError("Invalid or mismatched agent execution contract")
            record["executionId"] = data["executionId"]
            record["stopReason"] = data["stopReason"]
            record["agent"] = data
            trace_response = await self.client.get(self.endpoint + "/traces/" + data["executionId"], headers={"Authorization": f"Bearer {self.api_key}"})
            trace_response.raise_for_status()
            trace = trace_response.json()
            if trace["executionId"] != data["executionId"] or trace["promptHash"] != data["promptHash"] or trace["toolCalls"] != data["toolCalls"] or trace.get("outputHash") != hashlib.sha256(data["output"].encode()).hexdigest():
                raise ValueError("Durable trace does not match agent response")
            record["traceVerified"] = True
            (self.artifacts / f"{run_id}.trace.json").write_text(json.dumps(trace, indent=2) + "\n")
            if data["mode"] != "live_llm" or not data["benchmarkEligible"] or not data["model"] or data.get("fallback") is not False:
                return AgentResponse(output="", error="live_agent_execution_unavailable:" + data["stopReason"],
                                     latency_ms=(time.perf_counter() - started) * 1000,
                                     metadata={"status_code": 503, "execution_id": data["executionId"]})
            calls = [ToolCall(name=call["requestedName"], arguments=call["arguments"], call_id=call["id"]) for call in data["toolCalls"]]
            usage = data["usage"]
            normalized = normalize_usage(usage.get("inputTokens"), usage.get("outputTokens"))
            return AgentResponse(output=data["output"], latency_ms=(time.perf_counter() - started) * 1000,
                tool_calls=calls, usage=normalized, stop_reason=data["stopReason"], framework=self.adapter_type,
                metadata={"execution_id": data["executionId"], "tool_lifecycle": data["toolCalls"], "policy_decisions": data["policyDecisions"], "trace_verified": True},
                provenance={"tool_calls": "verified", "usage": "verified" if normalized else "unknown", "stop_reason": "verified"})
        except httpx.TimeoutException:
            record["error"] = "evaluation_timeout"
            return AgentResponse(output="", error="evaluation_timeout", latency_ms=(time.perf_counter() - started) * 1000, metadata={"exception_mro": ["TimeoutError"]})
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            record["error"] = "evaluation_transport_or_contract_error"
            return AgentResponse(output="", error=record["error"], latency_ms=(time.perf_counter() - started) * 1000, metadata={"status_code": 503})
        finally:
            record["latencyMs"] = (time.perf_counter() - started) * 1000
            self.attempts.append(record)
            with (self.artifacts / "attempts.jsonl").open("a") as stream:
                stream.write(json.dumps(record) + "\n")

    async def close(self) -> None:
        await self.client.aclose()
