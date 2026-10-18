import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AnalyzePortfolioRiskDto } from "./dto/analyze-portfolio-risk.dto";
import { PortfolioRiskService } from "./portfolio-risk.service";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizePortfolioRiskRun } from "./agent-observatory.summaries";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/portfolio-risk")
export class PortfolioRiskController {
  constructor(
    private readonly risk: PortfolioRiskService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Post("analyze")
  async analyze(
    @Request() request: AuthenticatedRequest,
    @Body() dto: AnalyzePortfolioRiskDto,
  ): Promise<CustomJsonResponse<PortfolioRiskAnalysis>> {
    return {
      status: "success",
      message: "Deterministic portfolio risk analysis completed successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "portfolio-risk-lab",
        workflow: "analyze_portfolio_risk",
        execute: () => this.risk.analyze({
          allocations: dto.allocations,
          portfolioValueUsd: dto.portfolioValueUsd,
          hypothetical: dto.hypothetical,
        }),
        summarize: summarizePortfolioRiskRun,
      }),
    };
  }
}
