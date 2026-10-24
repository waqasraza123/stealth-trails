"""Explicitly opted-in real-provider smoke path, separate from the benchmark."""
import argparse
import asyncio
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from adapter import StealthTrailsAdapter


async def smoke(args):
    if not args.live or args.budget_usd < 0.5:
        raise SystemExit("NOT EXECUTED: requires --live --budget-usd >= 0.5 and a configured real provider")
    with tempfile.TemporaryDirectory() as directory:
        adapter = StealthTrailsAdapter(args.endpoint, os.environ.get("AI_EVALUATION_API_KEY", ""), Path(directory), max_attempts=1)
        adapter.on_start(SimpleNamespace(id="manual-live-provider-smoke", prompt="Retrieve my actual portfolio snapshot using the available tool and summarize its holdings with evidence."))
        try:
            metadata = await adapter.client.get(adapter.endpoint + "/metadata", headers={"Authorization":"Bearer " + adapter.api_key})
            metadata.raise_for_status()
            if args.budget_usd < metadata.json()["limits"]["maxSpendUsd"]:
                raise SystemExit("NOT EXECUTED: requested budget below server reservation ceiling")
            result = await adapter.execute(adapter.current_entry.prompt)
            if result.error or not any(call["status"] == "succeeded" for call in (result.metadata or {}).get("tool_lifecycle", [])):
                raise SystemExit("Live smoke failed: " + (result.error or "no completed tool call"))
            print(result.model_dump_json(indent=2))
        finally:
            await adapter.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--budget-usd", type=float, default=0)
    parser.add_argument("--endpoint", default="http://127.0.0.1:9011")
    asyncio.run(smoke(parser.parse_args()))
