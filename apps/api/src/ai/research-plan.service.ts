import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CopilotService } from "./copilot.service";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type {
  Opportunity,
  OpportunityScenario,
} from "./opportunity-hunter.types";
import type {
  InvestmentResearchPlan,
  ResearchPlanComparison,
  ResearchPlanInput,
  ResearchPlanScenario,
  ResearchPlanStudioDashboard,
} from "./research-plan.types";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import type { InvestmentCommitteeReview } from "./investment-committee.types";
import {
  calculateDiversification,
  calculateHalalWeights,
  calculateWeightedRisk,
  RISK_TOLERANCE_MAXIMUM,
} from "./portfolio-risk.engine";

const CREATED_ACTION = "investment_research_plan.created";
const REVISED_ACTION = "investment_research_plan.revised";
const PLAN_ACTIONS = [CREATED_ACTION, REVISED_ACTION];
const DISCLAIMER =
  "This saved plan is an educational simulation, not investment advice, an offer, a religious ruling, a forecast, or authorization to execute a transaction. Modeled outcomes can differ materially from real results and do not guarantee returns.";

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function planFromEvent(event: {
  metadata: Prisma.JsonValue | null;
}): InvestmentResearchPlan | null {
  const plan = asObject(event.metadata).plan;
  return typeof plan === "object" && plan !== null && !Array.isArray(plan)
    ? (plan as unknown as InvestmentResearchPlan)
    : null;
}

function scenarioFor(
  opportunity: Opportunity,
  kind: OpportunityScenario["kind"],
): OpportunityScenario {
  return (
    opportunity.scenarios.find((scenario) => scenario.kind === kind) ?? {
      kind,
      label: `${kind} evidence gap`,
      returnRangePercent: [0, 0],
      timeHorizonMonths: 12,
      assumptions: ["No asset-specific scenario was available; a zero-return placeholder is used."],
    }
  );
}

@Injectable()
export class ResearchPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunities: OpportunityHunterService,
    private readonly copilot: CopilotService,
    private readonly rateLimit: WealthBriefRateLimitService,
  ) {}

  async getDashboard(
    supabaseUserId: string,
  ): Promise<ResearchPlanStudioDashboard> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const [plans, research] = await Promise.all([
      this.listLatestPlans(customerId),
      this.opportunities.discover(),
    ]);
    const capabilities = this.opportunities.getAnalystCapabilities();
    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        revision: plan.revision,
        title: plan.title,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        datasetKind: plan.datasetKind,
        evidenceAsOf: plan.evidenceAsOf,
        allocationCount: plan.allocations.length,
        riskLabel: plan.portfolioAnalysis.riskLabel,
        halalStatus: plan.halalAnalysis.overallStatus,
      })),
      opportunities: research.opportunities.map((opportunity) => ({
        id: opportunity.id,
        name: opportunity.name,
        symbol: opportunity.symbol,
        score: opportunity.score,
        riskLevel: opportunity.riskLevel,
        halalStatus: opportunity.halalScreening.status,
        synthetic: opportunity.synthetic,
        evidenceAsOf: opportunity.updatedAt,
      })),
      capabilities: {
        externalAiAvailable: capabilities.available,
        productionAiDisabled: process.env.NODE_ENV === "production",
        calculationsDeterministic: true,
        exportFormat: "json",
      },
      historyNote:
        plans.length > 0
          ? "Only the latest saved revision of each customer-owned plan is listed. Every revision remains in the audit history."
          : "No research plans have been saved for this customer yet.",
    };
  }

  async getPlan(
    supabaseUserId: string,
    planId: string,
  ): Promise<InvestmentResearchPlan> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    return this.getLatestPlan(customerId, planId);
  }

  async createPlan(
    supabaseUserId: string,
    input: ResearchPlanInput,
    committeeReview?: InvestmentCommitteeReview,
  ): Promise<InvestmentResearchPlan> {
    await this.rateLimit.assertAllowed(supabaseUserId);
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const copilotFindings = input.sourceConversationId
      ? this.copilotFindings(await this.copilot.getConversation(
        supabaseUserId,
        input.sourceConversationId,
      ))
      : [];
    const now = new Date().toISOString();
    const plan = await this.buildPlan({
      id: randomUUID(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      input,
      copilotFindings,
    });
    if (committeeReview) {
      plan.strategy.rationale = [committeeReview.summary, ...plan.strategy.rationale];
      plan.strategy.risks = [...new Set([...plan.strategy.risks, ...committeeReview.challenges.map((item) => item.reason)])];
      plan.strategy.researchSteps = [...new Set([...committeeReview.nextResearchSteps, ...plan.strategy.researchSteps])];
      plan.strategy.reassessmentConditions = [...new Set([...committeeReview.nextResearchSteps, ...plan.strategy.reassessmentConditions])];
    }
    await this.persistPlan(customerId, supabaseUserId, CREATED_ACTION, plan);
    return plan;
  }

  async revisePlan(
    supabaseUserId: string,
    planId: string,
    input: ResearchPlanInput,
  ): Promise<InvestmentResearchPlan> {
    await this.rateLimit.assertAllowed(supabaseUserId);
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const previous = await this.getLatestPlan(customerId, planId);
    const copilotFindings = input.sourceConversationId
      ? this.copilotFindings(await this.copilot.getConversation(
        supabaseUserId,
        input.sourceConversationId,
      ))
      : [];
    const plan = await this.buildPlan({
      id: planId,
      revision: previous.revision + 1,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      input,
      copilotFindings,
    });
    await this.persistPlan(customerId, supabaseUserId, REVISED_ACTION, plan);
    return plan;
  }

  async comparePlans(
    supabaseUserId: string,
    planIds: string[],
  ): Promise<ResearchPlanComparison> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const uniqueIds = [...new Set(planIds)];
    if (uniqueIds.length < 2) {
      throw new BadRequestException("Select at least two distinct plans.");
    }
    const plans = await Promise.all(
      uniqueIds.map((planId) => this.getLatestPlan(customerId, planId)),
    );
    return {
      plans,
      metrics: plans.map((plan) => ({
        planId: plan.id,
        title: plan.title,
        baselineProjectedValueUsd:
          plan.scenarios.find((scenario) => scenario.kind === "baseline")
            ?.projectedValueUsd ?? 0,
        pessimisticProjectedValueUsd:
          plan.scenarios.find((scenario) => scenario.kind === "pessimistic")
            ?.projectedValueUsd ?? 0,
        optimisticProjectedValueUsd:
          plan.scenarios.find((scenario) => scenario.kind === "optimistic")
            ?.projectedValueUsd ?? 0,
        weightedRiskScore: plan.portfolioAnalysis.weightedRiskScore,
        diversificationScore: plan.portfolioAnalysis.diversificationScore,
        halalStatus: plan.halalAnalysis.overallStatus,
      })),
      note: "Comparison uses the saved deterministic outputs of each plan revision. Different evidence dates, horizons, contributions, or allocations can make values non-equivalent.",
    };
  }

  private async buildPlan(args: {
    id: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
    input: ResearchPlanInput;
    copilotFindings: string[];
  }): Promise<InvestmentResearchPlan> {
    this.validateAllocations(args.input.allocations);
    const research = await this.opportunities.analyze(
      args.input.externalAiOptIn,
    );
    const byId = new Map(
      research.opportunities.map((opportunity) => [opportunity.id, opportunity]),
    );
    const selected = args.input.allocations.map((allocation) => {
      const opportunity = byId.get(allocation.opportunityId);
      if (!opportunity) {
        throw new BadRequestException(
          `Opportunity ${allocation.opportunityId} is not available in the current research dataset.`,
        );
      }
      return { allocation, opportunity };
    });
    const allocations = selected.map(({ allocation, opportunity }) => ({
      opportunityId: opportunity.id,
      name: opportunity.name,
      symbol: opportunity.symbol,
      percent: round2(allocation.percent),
      riskLevel: opportunity.riskLevel,
      halalStatus: opportunity.halalScreening.status,
      synthetic: opportunity.synthetic,
    }));
    const sharedAllocations = allocations.map((allocation) => ({
      percent: allocation.percent,
      riskLevel: allocation.riskLevel,
      halalStatus: allocation.halalStatus,
    }));
    const weightedRisk = calculateWeightedRisk(sharedAllocations);
    const diversification = calculateDiversification(sharedAllocations);
    const weightedRiskScore = weightedRisk.score;
    const riskLabel = weightedRisk.label;
    const diversificationScore = diversification.score;
    const maximumWeight = diversification.maximumWeight;
    const toleranceMaximum = RISK_TOLERANCE_MAXIMUM[args.input.goal.riskTolerance];
    const { statusWeights, overallStatus: overallHalalStatus } =
      calculateHalalWeights(sharedAllocations);
    const uncertaintyWarnings = selected.flatMap(({ allocation, opportunity }) => {
      const warnings: string[] = [];
      if (opportunity.halalScreening.status !== "eligible") {
        warnings.push(
          `${allocation.percent}% allocated to ${opportunity.name}, whose preliminary screen is ${opportunity.halalScreening.status.replace(/_/gu, " ")}.`,
        );
      }
      warnings.push(...opportunity.halalScreening.evidenceGaps.map(
        (gap) => `${opportunity.name}: ${gap}`,
      ));
      return warnings;
    });
    const evidence = selected.flatMap(({ opportunity }) =>
      opportunity.halalScreening.ruleResults.flatMap((rule) =>
        rule.evidence.map((item) => ({
          opportunityId: opportunity.id,
          evidenceId: item.evidenceId,
          sourceLabel: item.sourceLabel,
          observedAt: item.observedAt,
          synthetic: item.synthetic,
        })),
      ),
    );
    const scenarios = this.buildScenarios(selected, args.input.goal);
    const aiInsightById = new Map(
      research.ai.insights.map((insight) => [insight.opportunityId, insight]),
    );

    return {
      id: args.id,
      revision: args.revision,
      title: args.input.title.trim(),
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      sourceConversationId: args.input.sourceConversationId ?? null,
      goal: args.input.goal,
      allocations,
      portfolioAnalysis: {
        weightedRiskScore,
        riskLabel,
        diversificationScore,
        concentrationWarning:
          maximumWeight >= 70
            ? `${maximumWeight}% is concentrated in one opportunity; the simulation has limited diversification.`
            : null,
        riskToleranceAlignment:
          weightedRiskScore <= toleranceMaximum
            ? `The modeled risk score is within the configured ${args.input.goal.riskTolerance} tolerance band.`
            : `The modeled risk score exceeds the configured ${args.input.goal.riskTolerance} tolerance band and should be reassessed.`,
      },
      scenarios,
      halalAnalysis: {
        statusWeights,
        overallStatus: overallHalalStatus,
        uncertaintyWarnings: [...new Set(uncertaintyWarnings)],
        evidence: evidence.filter(
          (item, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.opportunityId === item.opportunityId &&
                candidate.evidenceId === item.evidenceId,
            ) === index,
        ),
        disclaimer:
          "Halal results are preliminary evidence-based screens, not religious certification. Questionable, excluded, and insufficient-evidence exposure is shown without reinterpretation.",
      },
      strategy: {
        rationale: selected
          .flatMap(({ opportunity }) => [
            `${opportunity.name}: ${opportunity.thesis}`,
            ...(aiInsightById.get(opportunity.id)?.reasoning ?? []),
          ])
          .concat(
            args.input.goal.ethicalPreferences.length > 0
              ? [`User-defined ethical preferences for ongoing review: ${args.input.goal.ethicalPreferences.join("; ")}.`]
              : [],
          )
          .concat(args.copilotFindings),
        assumptions: [
          "Allocation weights remain fixed for the modeled horizon; no rebalancing, fees, taxes, slippage, or custody costs are modeled.",
          "Monthly contributions are modeled as evenly distributed through the horizon and receive half of the scenario return.",
          ...selected.flatMap(({ opportunity }) => opportunity.researchPlan.assumptions),
        ],
        risks: [...new Set(selected.flatMap(({ opportunity }) => opportunity.researchPlan.riskConsiderations))],
        monitoringSignals: [...new Set(selected.flatMap(({ opportunity }) => opportunity.researchPlan.monitoringSignals))],
        reassessmentConditions: [...new Set(selected.flatMap(({ opportunity }) => opportunity.researchPlan.exitConditions))],
        researchSteps: [...new Set(selected.flatMap(({ opportunity }) => opportunity.researchPlan.researchSteps))],
        externalAiUsed: research.ai.externalAiUsed,
        mode: research.ai.externalAiUsed
          ? "ai_prioritized_evidence"
          : "deterministic",
        boundaryNote: research.ai.externalAiUsed
          ? "External AI only prioritized verified opportunity, evidence, and screening-rule IDs. All allocations, risk metrics, scenario values, and compliance summaries were calculated deterministically by the backend."
          : "The strategy explanation and every calculation were assembled deterministically from the current verified or clearly labeled synthetic research dataset.",
      },
      evidenceAsOf: research.dataset.asOf,
      datasetKind: research.dataset.kind,
      methodologyVersion: `research-plan-v1+${research.dataset.methodologyVersion}`,
      disclaimer: DISCLAIMER,
    };
  }

  private buildScenarios(
    selected: Array<{
      allocation: { opportunityId: string; percent: number };
      opportunity: Opportunity;
    }>,
    goal: ResearchPlanInput["goal"],
  ): ResearchPlanScenario[] {
    const mappings = [
      ["optimistic", "upside"],
      ["baseline", "base"],
      ["pessimistic", "downside"],
    ] as const;
    const contributedAmountUsd = round2(
      goal.initialAmountUsd + goal.monthlyContributionUsd * goal.horizonMonths,
    );
    return mappings.map(([kind, sourceKind]) => {
      let low = 0;
      let high = 0;
      const assumptions: string[] = [];
      for (const { allocation, opportunity } of selected) {
        const scenario = scenarioFor(opportunity, sourceKind);
        const horizonScale = Math.min(
          3,
          goal.horizonMonths / Math.max(1, scenario.timeHorizonMonths),
        );
        low +=
          scenario.returnRangePercent[0] *
          horizonScale *
          allocation.percent /
          100;
        high +=
          scenario.returnRangePercent[1] *
          horizonScale *
          allocation.percent /
          100;
        assumptions.push(
          `${opportunity.name}: ${scenario.assumptions.join("; ")}`,
        );
      }
      const range: [number, number] = [round2(low), round2(high)];
      const modeledReturnPercent = round2((range[0] + range[1]) / 2);
      const project = (returnPercent: number) => {
        const rate = Math.max(-100, returnPercent) / 100;
        return round2(
          goal.initialAmountUsd * (1 + rate) +
            goal.monthlyContributionUsd *
              goal.horizonMonths *
              (1 + rate / 2),
        );
      };
      const projectedValueUsd = project(modeledReturnPercent);
      return {
        kind,
        weightedReturnRangePercent: range,
        modeledReturnPercent,
        projectedValueUsd,
        projectedRangeUsd: [project(range[0]), project(range[1])],
        contributedAmountUsd,
        gainOrLossUsd: round2(projectedValueUsd - contributedAmountUsd),
        targetGapUsd:
          goal.targetAmountUsd === null
            ? null
            : round2(goal.targetAmountUsd - projectedValueUsd),
        targetMet:
          goal.targetAmountUsd === null
            ? null
            : projectedValueUsd >= goal.targetAmountUsd,
        assumptions: [
          ...assumptions,
          `Asset scenario ranges were scaled linearly to ${goal.horizonMonths} months, capped at three times their published horizon; this is a deterministic educational assumption, not a forecast.`,
        ],
      };
    });
  }

  private validateAllocations(
    allocations: ResearchPlanInput["allocations"],
  ): void {
    if (new Set(allocations.map((item) => item.opportunityId)).size !== allocations.length) {
      throw new BadRequestException("Each opportunity may appear only once.");
    }
    const total = allocations.reduce((sum, item) => sum + item.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(
        `Allocation percentages must total 100; received ${round2(total)}.`,
      );
    }
  }

  private copilotFindings(
    conversation: Awaited<ReturnType<CopilotService["getConversation"]>>,
  ): string[] {
    return conversation.messages
      .filter((message) => message.role === "assistant")
      .slice(-3)
      .flatMap((message) => message.citations)
      .filter(
        (citation, index, all) =>
          all.findIndex((candidate) => candidate.id === citation.id) === index,
      )
      .slice(0, 8)
      .map(
        (citation) =>
          `Linked Copilot finding: ${citation.label}, observed ${citation.observedAt ?? "at an unavailable timestamp"}${citation.synthetic ? " (synthetic example)" : ""}.`,
      );
  }

  private async persistPlan(
    customerId: string,
    supabaseUserId: string,
    action: string,
    plan: InvestmentResearchPlan,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        customerId,
        actorType: "customer",
        actorId: supabaseUserId,
        action,
        targetType: "investment_research_plan",
        targetId: plan.id,
        metadata: { plan } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async listLatestPlans(
    customerId: string,
  ): Promise<InvestmentResearchPlan[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        customerId,
        action: { in: PLAN_ACTIONS },
        targetType: "investment_research_plan",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const seen = new Set<string>();
    return events.flatMap((event) => {
      if (!event.targetId || seen.has(event.targetId)) return [];
      const plan = planFromEvent(event);
      if (!plan) return [];
      seen.add(event.targetId);
      return [plan];
    });
  }

  private async getLatestPlan(
    customerId: string,
    planId: string,
  ): Promise<InvestmentResearchPlan> {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        customerId,
        action: { in: PLAN_ACTIONS },
        targetType: "investment_research_plan",
        targetId: planId,
      },
      orderBy: { createdAt: "desc" },
    });
    const plan = event ? planFromEvent(event) : null;
    if (!plan) throw new NotFoundException("Research plan not found.");
    return plan;
  }

  private async resolveCustomerId(supabaseUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer.id;
  }
}
