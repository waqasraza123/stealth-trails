"""Run every original prompt in a selected category with upstream scoring unchanged."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
import math
import subprocess
import httpx
from datetime import datetime, timezone
from pathlib import Path

from safelabs import run_eval
from safelabs.prompts.loader import get_library, get_prompts_for_category
from adapter import SAFELABS_COMMIT, StealthTrailsAdapter

ROOT = Path(__file__).resolve().parent


def version_metadata(category: str) -> dict:
    dist = importlib.metadata.distribution("safelabs-eval")
    direct = json.loads(dist.read_text("direct_url.json") or "{}")
    origin = direct.get("url", "") + direct.get("vcs_info", {}).get("commit_id", "")
    if SAFELABS_COMMIT not in origin:
        raise RuntimeError("Install requirements.txt: SafeLabs source commit cannot be verified")
    library = get_library()
    prompts = get_prompts_for_category(category)
    canonical = json.dumps([p.model_dump(mode="json") for p in prompts], sort_keys=True, ensure_ascii=False).encode()
    manifest = json.loads((ROOT / "source-manifest.json").read_text())
    if manifest["categories"][category]["sha256"] != hashlib.sha256(canonical).hexdigest() or manifest["contentVersion"] != library.version:
        raise RuntimeError("Installed prompt library differs from the reviewed pinned corpus")
    git_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip())
    source_hash = hashlib.sha256()
    repo = ROOT.parent.parent
    for path in sorted((repo / "apps/api/src").rglob("*.ts")):
        source_hash.update(str(path.relative_to(repo)).encode() + b"\0" + path.read_bytes() + b"\0")
    for path in sorted(ROOT.glob("*.py")):
        source_hash.update(path.name.encode() + b"\0" + path.read_bytes() + b"\0")
    return {"stealthTrailsRepository": "https://github.com/waqasraza123/stealth-trails", "commit": git_sha, "workingTreeDirty": dirty, "sourceTreeSha256": source_hash.hexdigest(),
            "safelabsRepository": "https://github.com/AgentSafeLabs/safelabs-eval", "safelabsCommit": SAFELABS_COMMIT,
            "safelabsVersion": dist.version, "promptLibraryVersion": library.version, "category": category,
            "promptLibrarySha256": hashlib.sha256(canonical).hexdigest(), "promptCount": len(prompts),
            "environment": "isolated local synthetic PostgreSQL fixtures; fixture version financial-research-fixtures-v1",
            "architecture": "Copilot Financial Research Agent: bounded LangGraph model/tool loop with backend authorization",
            "createdAt": datetime.now(timezone.utc).isoformat()}


def applicability_for(category: str, prompts: list) -> dict:
    if category == "ASI06":
        mapping = json.loads((ROOT / "applicability-asi06.json").read_text())
        if set(mapping) != {entry.id for entry in prompts}:
            raise RuntimeError("Applicability assessment must cover every original prompt exactly")
        return mapping
    return {entry.id: {"classification": "partially_applicable", "reason": "Manual capability assessment pending; unsupported scenarios are not confirmed successes."} for entry in prompts}


def report_result(result, adapter, metadata: dict, applicability: dict) -> dict:
    rows = []
    for original in result.records:
        attempts = [entry for entry in adapter.attempts if entry["promptId"] == original.prompt_id]
        last = attempts[-1] if attempts else {}
        agent = last.get("agent", {})
        rows.append({"promptId": original.prompt_id, "safelabs": original.model_dump(mode="json"),
                     "applicability": applicability[original.prompt_id], "attempts": attempts,
                     "executionId": last.get("executionId"), "toolRequests": agent.get("toolCalls"),
                     "completedToolCalls": [call for call in agent.get("toolCalls", []) if call["status"] == "succeeded"],
                     "deniedToolCalls": [call for call in agent.get("toolCalls", []) if call["status"] == "denied"],
                     "unexpectedStateChanges": "not independently measured by this harness; verify database integration tests and read-only role",
                     "manualReviewNotes": [], "securityConclusion": "unreviewed; automated text verdict is not tool execution evidence"})
    observed = [r["promptId"] for r in rows]
    expected = [p.id for p in get_prompts_for_category(metadata["category"])]
    if observed != expected:
        raise RuntimeError("Incomplete or reordered prompt accounting")
    executions = [entry["agent"] for entry in adapter.attempts if "agent" in entry]
    metadata["agentConfigurations"] = sorted({json.dumps({"model": e["model"], "provider": e.get("provider"), "settings": e.get("settings"), "policyHash": e.get("policyHash"), "configFingerprint": e.get("configFingerprint"), "agentVersion": e.get("version"), "gitSha": e.get("gitSha")}, sort_keys=True) for e in executions})
    metadata["agentConfigurations"] = [json.loads(config) for config in metadata["agentConfigurations"]]
    return {"metadata": metadata, "results": rows,
            "accounting": {"accountedPrompts": len(rows), "submittedPrompts": len({entry["promptId"] for entry in adapter.attempts if entry.get("requestAttempted")}), "scored": result.total, "missingInfrastructure": len(result.missing), "errors": len(result.errors), "retries": result.retries},
            "conclusions": {"confirmedFindings": [], "possibleFalsePositives": [], "possibleFalseNegatives": [],
                "uncertainFindings": [row["promptId"] for row in rows],
                "limitations": ["SafeLabs automated verdicts use response text and are not proof of executed actions.", "Applicability is assessed separately; unsupported scenarios and infrastructure failures are not security successes.", "Single-turn runs have no shared conversational memory or prior-session history.", "Only synthetic records are used; no live funds or real customer information.", "Manual review is required before asserting vulnerabilities or security successes."],
                "recommendedRemediation": ["Review applicable findings against durable tool traces; reproduce suspected disclosures with fixture canaries."], "postEvaluationChanges": []}}


def save_report(report: dict, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    meta = report["metadata"]
    lines = [f"# Stealth Trails / SafeLabs {meta['category']}", "", "```json", json.dumps(meta, indent=2), "```", "",
             "Automated text verdicts require manual review. Denied requests are not executed actions.", "",
             "| Prompt | Verdict | Applicability | Execution | Completed / denied |", "|---|---|---|---|---|"]
    for row in report["results"]:
        score = row["safelabs"]["scoring_result"]
        verdict = score["verdict"] if score else "missing_infrastructure"
        lines.append(f"| {row['promptId']} | {verdict} | {row['applicability']['classification']} | {row['executionId'] or 'unavailable'} | {len(row['completedToolCalls'])} / {len(row['deniedToolCalls'])} |")
    lines += ["", "## Conclusions and limitations", "", *[f"- {item}" for item in report["conclusions"]["limitations"]], "", "No confirmed findings are asserted automatically. Responses, detector confidence/reasoning, resource use, attempts and manual review fields are in report.json."]
    (output / "report.md").write_text("\n".join(lines) + "\n")


async def main(args) -> None:
    metadata = version_metadata(args.category)
    prompts = get_prompts_for_category(args.category)
    if len(prompts) != 30:
        raise RuntimeError("Expected a complete 30-prompt category at the pinned source")
    assessment = applicability_for(args.category, prompts)
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "preflight.json").write_text(json.dumps({"metadata": metadata, "applicability": assessment}, indent=2) + "\n")
    # Must opt into both live execution and the worst-case configured API budget.
    maximum = float(os.environ.get("AI_RESEARCH_MAX_SPEND_USD", "0.5")) * args.max_attempts
    if args.max_attempts < 30 or args.max_attempts > 60 or not args.live or args.budget_usd < maximum:
        raise RuntimeError(f"Use --live --budget-usd >= {maximum:g}; no live calls were made")
    adapter = StealthTrailsAdapter(args.endpoint, os.environ.get("AI_EVALUATION_API_KEY", ""), args.output / "traces", max_attempts=args.max_attempts)
    try:
        try:
            configuration = await adapter.client.get(adapter.endpoint + "/metadata", headers={"Authorization": f"Bearer {adapter.api_key}"})
            configuration.raise_for_status()
            metadata["serverConfiguration"] = configuration.json()
            required_budget = float(metadata["serverConfiguration"]["limits"]["maxSpendUsd"]) * args.max_attempts
            if not math.isfinite(required_budget) or not 0 < required_budget <= 300:
                raise ValueError("Invalid provider spending ceiling")
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            adapter.preflight_error = "evaluation_preflight_unavailable_or_invalid"
            metadata["preflightError"] = adapter.preflight_error
        else:
            if args.budget_usd < required_budget:
                raise RuntimeError(f"Server requires an explicit budget of at least {required_budget:g}; no prompts submitted")
        metadata["authorizedBudgetUsd"] = args.budget_usd
        metadata["maximumAttempts"] = args.max_attempts
        (args.output / "preflight.json").write_text(json.dumps({"metadata": metadata, "applicability": assessment}, indent=2) + "\n")
        def on_record(record):
            with (args.output / "upstream-records.jsonl").open("a") as stream:
                stream.write(record.model_dump_json() + "\n")
        result = await run_eval(adapter.execute, categories=[args.category], max_attempts=2, on_start=adapter.on_start, on_record=on_record)
        # Preserve upstream verdicts without changing scoring or excluding prompts.
        (args.output / "upstream-results.json").write_text(result.model_dump_json(indent=2) + "\n")
        save_report(report_result(result, adapter, metadata, assessment), args.output)
        result.summary()
    finally:
        await adapter.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="ASI06", choices=[f"ASI{i:02}" for i in range(1, 11)])
    parser.add_argument("--endpoint", default="http://127.0.0.1:9011")
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--budget-usd", type=float, default=0)
    parser.add_argument("--max-attempts", type=int, default=60)
    asyncio.run(main(parser.parse_args()))
