import { Body, Controller, Get, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GenerateWealthBriefDto } from "./dto/generate-wealth-brief.dto";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { WealthBriefService } from "./wealth-brief.service";
import type {
  WealthBriefCapabilities,
  WealthBriefResult,
} from "./wealth-brief.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizeWealthBriefRun } from "./agent-observatory.summaries";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("ai/wealth-brief")
export class AiController {
  constructor(
    private readonly wealthBriefService: WealthBriefService,
    private readonly rateLimitService: WealthBriefRateLimitService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Get("capabilities")
  getCapabilities(): CustomJsonResponse<WealthBriefCapabilities> {
    return {
      status: "success",
      message: "AI wealth brief capabilities retrieved successfully.",
      data: this.wealthBriefService.getCapabilities(),
    };
  }

  @Post()
  async generate(
    @Request() request: AuthenticatedRequest,
    @Body() dto: GenerateWealthBriefDto,
  ): Promise<CustomJsonResponse<WealthBriefResult>> {
    const result = await this.observatory.observeCustomer(request.user.id, {
      agentId: "wealth-brief",
      workflow: "generate_wealth_brief",
      execute: async () => {
        await this.rateLimitService.assertAllowed(request.user.id);
        return this.wealthBriefService.generate(
          request.user.id,
          dto.externalAiOptIn === true,
        );
      },
      summarize: summarizeWealthBriefRun,
    });

    return {
      status: "success",
      message:
        result.mode === "ai_generated"
          ? "AI wealth brief generated successfully."
          : "Deterministic wealth brief preview generated successfully.",
      data: result,
    };
  }
}
