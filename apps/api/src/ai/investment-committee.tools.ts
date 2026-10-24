import { Injectable } from "@nestjs/common";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { CopilotService } from "./copilot.service";
import type { InvestmentCommitteeMission, InvestmentCommitteeReview } from "./investment-committee.types";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import { PortfolioRiskService } from "./portfolio-risk.service";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import { ResearchPlanService } from "./research-plan.service";
import type { InvestmentResearchPlan } from "./research-plan.types";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";

const noInputSchema = z.object({}).strict();
type Allocation = { opportunityId: string; percent: number };

export type HalalFinding = {
  opportunityId: string;
  name: string;
  status: string;
  rationale: string[];
  evidenceGaps: string[];
  evidenceIds: string[];
};

@Injectable()
export class InvestmentCommitteeTools {
  constructor(
    private readonly opportunities: OpportunityHunterService,
    private readonly risk: PortfolioRiskService,
    private readonly plans: ResearchPlanService,
    private readonly copilot: CopilotService,
    private readonly rateLimit: WealthBriefRateLimitService,
  ) {}

  opportunity(supabaseUserId: string, mission: InvestmentCommitteeMission) {
    return tool(
      async (): Promise<OpportunityHunterResponse> => {
        await this.rateLimit.assertAllowed(supabaseUserId);
        return this.opportunities.analyze(mission.externalAiConsent);
      },
      {
        name: "opportunity_hunter_read_only",
        description: "Read and rank the existing evidence-bound opportunity research catalog. This tool cannot trade or move funds.",
        schema: noInputSchema,
      },
    );
  }

  portfolioRisk(mission: InvestmentCommitteeMission, allocations: Allocation[]) {
    return tool(
      async (): Promise<PortfolioRiskAnalysis> =>
        this.risk.analyze({
          allocations,
          portfolioValueUsd: mission.input.portfolioValueUsd,
        }),
      {
        name: "portfolio_risk_lab_read_only",
        description: "Run the existing deterministic portfolio exposure and stress analysis. This tool cannot rebalance or execute transactions.",
        schema: noInputSchema,
      },
    );
  }

  halalResearch(research: OpportunityHunterResponse, allocations: Allocation[]) {
    return tool(
      async (): Promise<HalalFinding[]> => {
        const selectedIds = new Set(allocations.map((item) => item.opportunityId));
        return research.opportunities
          .filter((item) => selectedIds.has(item.id))
          .map((opportunity) => ({
            opportunityId: opportunity.id,
            name: opportunity.name,
            status: opportunity.halalScreening.status,
            rationale: opportunity.halalScreening.rationale,
            evidenceGaps: opportunity.halalScreening.evidenceGaps,
            evidenceIds: opportunity.halalScreening.ruleResults.flatMap((rule) =>
              rule.evidence.map((item) => item.evidenceId),
            ),
          }));
      },
      {
        name: "halal_evidence_screen_read_only",
        description: "Read the existing preliminary Shariah evidence screen without issuing or changing a religious ruling.",
        schema: noInputSchema,
      },
    );
  }

  strategy(
    supabaseUserId: string,
    mission: InvestmentCommitteeMission,
    allocations: Allocation[],
    review?: InvestmentCommitteeReview,
  ) {
    return tool(
      async (): Promise<InvestmentResearchPlan> =>
        this.plans.createPlan(supabaseUserId, {
          title: `Committee research · ${mission.goal.slice(0, 80)}`,
          externalAiOptIn: mission.externalAiConsent,
          goal: {
            objective: mission.goal,
            initialAmountUsd: mission.input.portfolioValueUsd,
            monthlyContributionUsd: 0,
            targetAmountUsd: null,
            horizonMonths: mission.input.horizonMonths,
            riskTolerance: mission.input.riskTolerance,
            ethicalPreferences: mission.input.ethicalPreferences,
          },
          allocations,
        }, review),
      {
        name: "research_plan_studio_read_only",
        description: "Create an educational scenario and monitoring plan using the existing Research Plan Studio. This tool cannot execute the plan.",
        schema: noInputSchema,
      },
    );
  }

  synthesis(
    supabaseUserId: string,
    mission: InvestmentCommitteeMission,
    allocations: Allocation[],
  ) {
    return tool(
      async () =>
        this.copilot.sendMessage(supabaseUserId, {
          message: `Consolidate educational evidence for this research goal: ${mission.goal}`,
          externalAiOptIn: mission.externalAiConsent,
          portfolioRiskContext: {
            allocations,
            portfolioValueUsd: mission.input.portfolioValueUsd,
          },
          searchDocuments: false,
        }),
      {
        name: "financial_copilot_synthesis_read_only",
        description: "Create a cited educational synthesis from server-authored research statements. This tool has no financial execution capability.",
        schema: noInputSchema,
      },
    );
  }

}
