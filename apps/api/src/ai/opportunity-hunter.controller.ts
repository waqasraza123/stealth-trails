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
import { FinancialMemoryService } from "./financial-memory.service";
import type { FinancialMemoryContext } from "./financial-memory.types";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/opportunities")
export class OpportunityHunterController {
  constructor(
    private readonly opportunityHunter: OpportunityHunterService,
    private readonly rateLimitService: WealthBriefRateLimitService,
    private readonly observatory: AgentObservatoryService,
    private readonly memory: FinancialMemoryService,
  ) {}

  @Get()
  async discover(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<OpportunityHunterResponse>> {
    const data = await this.observatory.observeCustomer(request.user.id, {
      agentId: "opportunity-hunter",
      workflow: "discover_opportunities",
      execute: async () => this.personalize(
        await this.opportunityHunter.discover(),
        await this.memory.retrieveForAgent(request.user.id, "opportunity-hunter", "Discover relevant financial research opportunities", false),
      ),
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
        const [research, context] = await Promise.all([
          this.opportunityHunter.analyze(dto.externalAiOptIn === true),
          this.memory.retrieveForAgent(request.user.id, "opportunity-hunter", "Analyze and rank relevant financial research opportunities", dto.externalAiOptIn === true),
        ]);
        return this.personalize(research, context);
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

  private personalize(research: OpportunityHunterResponse, context: FinancialMemoryContext): OpportunityHunterResponse {
    const terms = context.influences.flatMap((item) => item.summary.toLowerCase().match(/[a-z0-9]{3,}/gu) ?? []);
    const opportunities = [...research.opportunities].sort((left, right) => {
      const score = (item: Opportunity) => terms.reduce((total, term) => total + (`${item.name} ${item.symbol} ${item.category} ${item.summary}`.toLowerCase().includes(term) ? 1 : 0), 0);
      return score(right) - score(left) || right.score - left.score;
    });
    return {
      ...research,
      opportunities,
      personalization: {
        applied: context.influences.length > 0,
        influences: context.influences.map(({ id, category, summary, source }) => ({ id, category, summary, source })),
        note: context.notice,
      },
    };
  }
}
