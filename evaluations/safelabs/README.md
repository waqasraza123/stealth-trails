# Stealth Trails agent security evaluation

This runs the **actual Copilot Financial Research Agent** through NestJS. Stealth Trails is financial-software engineering infrastructure, not a licensed or operational bank. No live security benchmark results are committed. Mock-model tests are verification of dispatch and transport, not evidence of live-model security.

## Architecture and boundaries

`POST /ai/copilot/research` adds an opt-in mode to the authenticated Copilot API. Its body is `{ "prompt": "...", "externalAiOptIn": true, "runId": "optional" }`. Existing statement-ranked Copilot answers, Committee orchestration, transaction execution and approvals retain their existing paths.

The new LangGraph alternates a model node and an authorized tool-dispatch node. The configured model receives the original user request, dynamically chooses zero or more tools with structured arguments, observes actual service results, and generates the final answer. No keyword classifier chooses tools. Tool outputs and documents are untrusted evidence. After a policy denial the model can explain the denial with tools disabled. It cannot grant itself permissions.

| Stable tool            | Actual data/service                                        | Enforced boundary                                                                                                       |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `portfolio_snapshot`   | CustomerBalancesService and persisted supported holdings   | Authenticated subject only; 50 holdings; no wallet/account IDs returned                                                 |
| `transaction_history`  | Existing TransactionIntent/Asset projections in PostgreSQL | Both customer ID and authenticated subject bound in query; 20 statuses; counterparties excluded                         |
| `market_observations`  | MarketDataService                                          | Server-selected provider only; 20 observations; freshness/source retained                                               |
| `opportunity_research` | OpportunityHunterService                                   | Existing deterministic assessments; synthetic evidence labeled                                                          |
| `portfolio_risk`       | PortfolioRiskService and current risk engine               | Bounded hypothetical inputs; existing allocation validation and calculations                                            |
| `document_passages`    | DocumentIntelligenceService local passage search           | Ownership checked before retrieval; customer-scoped join; five cited passages of 1,600 characters                       |
| `financial_memory`     | FinancialMemoryService                                     | Profile/agent authorization and external-provider consent checked first; five entries; no embeddings or memory mutation |
| `research_plan`        | Existing saved plan audit records                          | Customer-owned latest revision; objective and recorded assumptions only; cannot create/execute plans                    |

All inputs use strict Zod object schemas; outputs have validated typed projections. Tools never accept customer/account/tenant claims. Every call passes the backend policy, and service queries enforce ownership independently. The registry has no transfers, withdrawals, wallet signing, approval changes, ledger writes, SQL, shell, browsing, exports or configuration mutation capabilities. System instructions alone do not enforce these restrictions.

Default execution bounds: eight model steps, twelve dispatched tool calls, 60 seconds, 48,000 conservatively reserved tokens, 1,000 output tokens per model call, $0.50 maximum reserved provider cost per execution, $30 global daily reservation, 60 requests per authenticated subject/hour, and four active executions/process. Request rate and daily spending reservations are atomic PostgreSQL counters with no outage fallback. Token/spending reservations use UTF-8 context bytes plus complete tool schemas and output ceilings; they intentionally overestimate typical tokenization. Configure pricing ceilings for the chosen model. Actual token counts are recorded when provided; actual billed cost is `null` because model pricing is not independently verified. Reservations are not refunded, including after failed runs. Daily reservations apply to the whole database, including both fixtures.

Stop reasons include completion, provider rejection, approval required, interruption, timeout, tool/step/token/spending limits, model error, policy violation and infrastructure failure. SDK retries are disabled; benchmark transport retries are separately recorded. A missing real provider returns `mode: unavailable`, empty output and `benchmarkEligible: false`, with no deterministic replacement.

## Isolated environment: recommended Docker path

Requires Docker Compose, Node/pnpm for development, Python 3.11+, and OpenSSL. Run from the repository root:

```sh
python3 evaluations/safelabs/prepare.py
python3 -m venv evaluations/safelabs/.venv
evaluations/safelabs/.venv/bin/pip install -r evaluations/safelabs/requirements.txt
```

Edit the newly generated **evaluations/safelabs/.env**, keeping it private. Set `AI_RESEARCH_ENABLED=true`, `AI_WEALTH_BRIEF_PROVIDER=openai_compatible`, a real provider API key, and an exact supported model ID in `AI_WEALTH_BRIEF_MODEL`. Set the input/output price ceilings for that model. The default gateway permits only HTTPS POST to `api.openai.com/v1/chat/completions`. It does not permit arbitrary destinations, redirects, tools, or browsing. A different compatible provider requires an explicit operator change to that fixed gateway upstream and provider configuration.

```sh
docker compose --env-file evaluations/safelabs/.env -f evaluations/safelabs/compose.yaml up --build -d
set -a
. evaluations/safelabs/.env
set +a
evaluations/safelabs/.venv/bin/python evaluations/safelabs/smoke.py --live --budget-usd 0.5
evaluations/safelabs/.venv/bin/python evaluations/safelabs/run.py --category ASI06 --live --budget-usd 30
```

The $30 command authorizes a conservative maximum of 60 attempts × $0.50, including retries; it is not an estimate of actual charges. The harness checks the server's advertised ceiling before submitting prompts. The global daily server budget can stop a run earlier if other executions have consumed reservations; these remain explicit failures. Another category is selected with `--category ASI01`, using its unchanged original prompts. Its applicability classifications require manual review.

Compose creates a private PostgreSQL database named `stealth_trails_agent_eval`, runs all existing migrations and idempotent fixture setup, provisions a restricted runtime role, then starts the dedicated evaluation entry point. Only `127.0.0.1:9011` is published. The agent and database use an internal-only Docker network. Only the fixed TLS model gateway has external network access. No banking `.env`, signing keys, production database, workers or transaction executors are loaded. The application image excludes all `.env` files. This container topology enforces outbound network isolation; running a developer process directly on the host does not provide the same OS network boundary.

The runtime role can SELECT research tables and insert/update audit/rate-limit records. It cannot update financial balances, transactions, account restrictions or approvals; it cannot read Customer authentication columns. It has a five-second SQL statement timeout and a one-second lock timeout. Startup rejects an unrestricted runtime role. Setup/teardown run with the separate fixture administrator. Do not reuse either role or database for banking development data.

Idempotent reseeding and fixture teardown:

```sh
docker compose --env-file evaluations/safelabs/.env -f evaluations/safelabs/compose.yaml run --rm fixtures node dist/ai/evaluation/fixtures.js setup
docker compose --env-file evaluations/safelabs/.env -f evaluations/safelabs/compose.yaml stop agent
docker compose --env-file evaluations/safelabs/.env -f evaluations/safelabs/compose.yaml run --rm fixtures node dist/ai/evaluation/fixtures.js teardown
docker compose --env-file evaluations/safelabs/.env -f evaluations/safelabs/compose.yaml down
```

Fixtures include Aurora and Boreal accounts, distinct balances, settled transactions, research notes/documents with citations, memory entries with different external-provider consent, saved plan assumptions, and a recorded market observation. There are no wallets, signing keys or funds. Recorded prices are labeled `recorded`; Opportunity Hunter/Risk Lab retain their existing explicitly synthetic catalog rather than treating fixture prices as live evidence.

## Local PostgreSQL alternative and integration tests

Use a developer-controlled local PostgreSQL instance with pgvector. Create an otherwise empty database named **stealth_trails_agent_eval**. Export explicit configuration, including disabled external data providers, because the project's existing config loader may read a development `.env`:

```sh
export NODE_ENV=test AI_EVALUATION_ENABLED=true
export MARKET_DATA_PROVIDER=disabled DOCUMENT_AI_ENABLED=false AI_OPPORTUNITY_ANALYST_ENABLED=false
export DATABASE_URL='postgresql://YOUR_FIXTURE_ADMIN@127.0.0.1:5432/stealth_trails_agent_eval'
export DIRECT_URL="$DATABASE_URL"
export AI_EVALUATION_RUNTIME_PASSWORD="$(openssl rand -hex 32)"
pnpm --filter @stealth-trails-bank/api exec ts-node src/ai/evaluation/fixtures.ts setup
AI_EVALUATION_INTEGRATION=true pnpm --filter @stealth-trails-bank/api exec jest --config jest.config.ts --runInBand --runTestsByPath src/ai/evaluation/evaluation.integration.spec.ts
```

These integration tests use deterministic mock models, real NestJS routes, real PostgreSQL fixtures, actual business services and the restricted database role. They check state changes against persisted financial tables. They are **not live benchmarks**. The suite is skipped unless explicitly opted in; it never targets the default application database.

To run the host evaluation server, configure the secured `AI_WEALTH_BRIEF_*` provider settings from `apps/api/.env.example`, `AI_RESEARCH_ENABLED=true`, separate evaluation keys of at least 32 characters, and change both database URLs to the provisioned `agent_eval_runtime` role. Then run `pnpm --filter @stealth-trails-bank/api exec ts-node src/ai/evaluation/main.ts`. The host server binds loopback only. Use container deployment when outbound network isolation is required.

## Evaluation API and evidence

The dedicated entry point exposes only protected evaluation routes:

- `POST /internal/ai-agent-evaluation/execute`: `{ "prompt": "unchanged arbitrary text", "runId": "optional-safe-correlation-id" }`.
- `GET /internal/ai-agent-evaluation/traces/:executionId`: sanitized durable trace, restricted to the same authenticated fixture.
- `GET /internal/ai-agent-evaluation/metadata`: safe model, limits, tool names, policy hash and fixture metadata.

Authenticate with `Authorization: Bearer $AI_EVALUATION_API_KEY`; that key maps only to Aurora. The independent peer key maps only to Boreal. Prompt text and run IDs cannot choose identity, permissions, provider configuration or consent. Bodies allow only the documented fields, 16,000 prompt characters and a 32 KiB HTTP body. Socket peers must be private/loopback; forwarded headers cannot grant network access. Evaluation mode is explicitly rejected in production and hosted Vercel environments and requires the dedicated local/container database name. The evaluation controller is **not imported by the regular application**.

Executions are checkpointed in Agent Observatory's existing PostgreSQL AuditEvent stream, not a disconnected logger. A trace has stable execution/trace IDs, server/agent/model versions, policy/config hashes, prompt/output hashes, model-decision metadata, requested tools, permission decisions, accepted/running/completed/denied/failed/timed-out statuses, result hashes/references, errors, durations and available usage. `executedName` is set only when execution starts; `status: succeeded` alone means completion. Raw model prose, private tool results, prompts and document contents are omitted from durable traces. Tool arguments retain safe numeric bounds and hashes of text/resource IDs. The owner receives the actual sanitized final output from execute. The harness verifies the trace's output hash and tool lifecycle against that response.

Do not interpret a model's statement that it performed an action as proof. Consult `requestedName`, `permitted`, `executedName`, and `status` separately. A request can be denied before execution, or accepted and fail before producing evidence. Deadlines abort model requests and stop observation; an already-started database read may finish in its driver after the deadline, but its late result is not used or marked successful.

## SafeLabs provenance and reports

Framework: [AgentSafeLabs/safelabs-eval at the pinned commit](https://github.com/AgentSafeLabs/safelabs-eval/tree/1df3ea043353fc38535b03e375d0becf1f343b8d), distribution 0.11.2, prompt content **1.13.0**. Requirements pin source archive/hash and resolved Python dependencies. `source-manifest.json` verifies each category's full original prompt/metadata checksum. The integration uses upstream `run_eval`, `AgentResponse`, `ToolCall`, infrastructure retry classification and scoring unchanged. The ASI taxonomy is SafeLabs' OWASP-inspired taxonomy, not a claim of official OWASP certification.

`applicability-asi06.json` records a reviewed mapping for **all 30** original ASI06 prompts before execution. Unsupported HR/medical/education/marketing systems are not claimed as demonstrated financial-agent security successes. All original prompts still reach the adapter unchanged; no applicability classification filters execution. Each prompt ID maps to every attempt and execution ID. Trace retrieval failures, missing live-model configuration, timeouts, execution limits and provider/infrastructure failures cannot become benchmark passes. Upstream text verdicts remain unchanged, including uncertain findings and possible false positives/negatives.

Each fresh ignored `reports/<timestamp>/` directory contains:

- `preflight.json`: reviewed applicability and version/config metadata before calls.
- `upstream-records.jsonl`, `upstream-results.json`: original upstream scoring/error records.
- `traces/attempts.jsonl` and per-execution trace JSON: latency, IDs, retries, lifecycle and policy evidence.
- `report.json`, `report.md`: complete prompt accounting, responses, verdict/confidence/reasoning, applicable/partial/unsupported classification, tool outcomes, usage, review notes, conclusions and limitations.

Reports contain synthetic outputs only and are ignored by Git. Persisted real customer records and credentials must never be added. Confirmed findings remain empty until a reviewer confirms them using traces and reproduction. Unchanged financial-state assertions come from the integration suite and restricted role; the benchmark harness itself does not claim to independently measure every database write. Schema/scoring changes upstream require a deliberate dependency, checksum and applicability review.

## Verification and remaining live step

```sh
pnpm --filter @stealth-trails-bank/api exec jest --config jest.config.ts --runInBand --runTestsByPath src/ai/financial-research.service.spec.ts src/ai/evaluation/evaluation.config.spec.ts
evaluations/safelabs/.venv/bin/python -m unittest discover -s evaluations/safelabs -p 'test_*.py' -v
```

The Python conformance test submits every original ASI06 prompt to a mock HTTP transport and proves ID accounting, lifecycle separation, missing-model rejection and infrastructure retry handling. It does not claim live agent results. The PostgreSQL integration suite also exercises the real LangChain HTTP tool-calling protocol against a clearly labeled mock provider. An independent Python/NestJS round trip verifies that missing model configuration returns an ineligible execution and a verifiable durable trace. The explicit real-provider smoke command above requires both `--live` and a budget. **The real-provider smoke and live 30-prompt evaluation have not been executed in this implementation session. No real-provider credentials were configured for the isolated runtime.**

Known limits: single-run conversation state is not a resumable multi-session product chat; no HR/CRM/medical/marketing integration exists; local document retrieval is bounded lexical matching rather than embedding similarity; text redaction is defense in depth, not semantic privacy proof; pricing ceilings depend on correct operator configuration; model-reported identifiers are recorded but provider honesty is not independently attested; tool output references are hashes, not unrestricted downloads; Docker's complete topology requires validation on a machine with a running daemon. Production external research remains disabled pending separate operational review.
