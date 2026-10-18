import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AnalyzeOpportunitiesDto } from "./dto/analyze-opportunities.dto";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import type {
  Opportunity,
  OpportunityHunterResponse,
} from "./opportunity-hunter.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizeOpportunityRun } from "./agent-observatory.summaries";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/opportunities")
export class OpportunityHunterController {
  constructor(
    private readonly opportunityHunter: OpportunityHunterService,
    private readonly rateLimitService: WealthBriefRateLimitService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Get()
  async discover(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<OpportunityHunterResponse>> {
    const data = await this.observatory.observeCustomer(request.user.id, {
      agentId: "opportunity-hunter",
      workflow: "discover_opportunities",
      execute: () => this.opportunityHunter.discover(),
      summarize: summarizeOpportunityRun,
    });
    return {
      status: "success",
      message:
        data.dataset.kind === "live_market"
          ? "Live opportunity research retrieved successfully."
          : "Synthetic fallback research retrieved successfully.",
      data,
    };
  }

  @Post("analyze")
  async analyze(
    @Request() request: AuthenticatedRequest,
    @Body() dto: AnalyzeOpportunitiesDto,
  ): Promise<CustomJsonResponse<OpportunityHunterResponse>> {
    const data = await this.observatory.observeCustomer(request.user.id, {
      agentId: "opportunity-hunter",
      workflow: "analyze_opportunities",
      execute: async () => {
        await this.rateLimitService.assertAllowed(request.user.id);
        return this.opportunityHunter.analyze(dto.externalAiOptIn === true);
      },
      summarize: summarizeOpportunityRun,
    });
    return {
      status: "success",
      message:
        data.ai.analysisMode === "ai_ranked"
          ? "AI opportunity analysis completed successfully."
          : "Deterministic opportunity research retrieved successfully.",
      data,
    };
  }

  @Get(":id")
  async findOne(
    @Request() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<CustomJsonResponse<Opportunity>> {
    return {
      status: "success",
      message: "Research opportunity retrieved successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "opportunity-hunter",
        workflow: "inspect_opportunity",
        execute: () => this.opportunityHunter.findOne(id),
        summarize: (opportunity) => ({
          mode: "deterministic",
          steps: [{
            id: "resolve-opportunity",
            label: "Resolve opportunity from current catalog",
            kind: "tool",
            status: "succeeded",
            toolName: "opportunity-hunter",
            outputSummary: "One bounded opportunity record was resolved.",
            evidenceIds: opportunity.evidence.map((item) => item.id),
            failureReason: null,
          }],
          evidence: opportunity.evidence.map((item) => ({
            evidenceId: item.id,
            sourceLabel: item.sourceLabel,
            sourceType: opportunity.marketData ? "market_data" : "synthetic_research",
            observedAt: item.observedAt,
            synthetic: item.synthetic,
            groundingDecision: "used",
          })),
        }),
      }),
    };
  }
}
