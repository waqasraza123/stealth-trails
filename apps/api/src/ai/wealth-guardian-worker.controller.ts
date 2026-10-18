import { Controller, Post, Request, UseGuards } from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { WealthGuardianService } from "./wealth-guardian.service";
import type { WealthGuardianScheduleResult } from "./wealth-guardian.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizeGuardianWorkerRun } from "./agent-observatory.summaries";

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("ai/wealth-guardian/internal/worker")
export class WealthGuardianWorkerController {
  constructor(
    private readonly wealthGuardian: WealthGuardianService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Post("run-scheduled")
  async runScheduled(
    @Request() request: { internalWorker: { workerId: string } },
  ): Promise<CustomJsonResponse<WealthGuardianScheduleResult>> {
    return {
      status: "success",
      message: "Scheduled Wealth Guardian research completed.",
      data: await this.observatory.observeWorker(
        request.internalWorker.workerId,
        {
          agentId: "wealth-guardian-worker",
          workflow: "run_scheduled_guardian_batch",
          execute: () => this.wealthGuardian.runScheduledResearch(
            request.internalWorker.workerId,
          ),
          summarize: summarizeGuardianWorkerRun,
        },
      ),
    };
  }
}
