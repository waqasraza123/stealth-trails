import type {
  HalalScreeningAssessment,
  HalalScreeningHistoryEntry,
  HalalScreeningRuleCategory,
  HalalScreeningRuleResult,
  HalalScreeningStatus,
  OpportunityEvidence,
} from "./opportunity-hunter.types";

export const HALAL_SCREENING_METHODOLOGY_VERSION =
  "preliminary-halal-screen-v1";

export type HalalScreeningConfig = {
  interestBearingDebtMaximumPercent: number;
  nonPermissibleIncomeMaximumPercent: number;
};

export const DEFAULT_HALAL_SCREENING_CONFIG: HalalScreeningConfig = {
  interestBearingDebtMaximumPercent: 30,
  nonPermissibleIncomeMaximumPercent: 5,
};

function percentage(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : fallback;
}

export function loadHalalScreeningConfig(
  env: NodeJS.ProcessEnv = process.env,
): HalalScreeningConfig {
  return {
    interestBearingDebtMaximumPercent: percentage(
      env.HALAL_SCREENING_MAX_INTEREST_BEARING_DEBT_PERCENT,
      DEFAULT_HALAL_SCREENING_CONFIG.interestBearingDebtMaximumPercent,
    ),
    nonPermissibleIncomeMaximumPercent: percentage(
      env.HALAL_SCREENING_MAX_NON_PERMISSIBLE_INCOME_PERCENT,
      DEFAULT_HALAL_SCREENING_CONFIG.nonPermissibleIncomeMaximumPercent,
    ),
  };
}

type EvidenceBoundSignal = {
  outcome: "passed" | "failed" | "review_required" | "not_assessed";
  explanation: string;
  evidenceIds: string[];
};

export type HalalScreeningInput = {
  assessedAt: string;
  synthetic: boolean;
  interestBasedActivity: EvidenceBoundSignal;
  prohibitedIndustry: EvidenceBoundSignal;
  financialRatios: {
    interestBearingDebtPercent: number | null;
    nonPermissibleIncomePercent: number | null;
    evidenceIds: string[];
  };
  ethicalConcerns: EvidenceBoundSignal;
  previousAssessments?: HalalScreeningHistoryEntry[];
};

const SCREENING_DISCLAIMER =
  "This preliminary, evidence-bound research screen is not a fatwa, religious ruling, or certification. Thresholds vary among methodologies; consult a qualified Shariah adviser before making decisions.";

type HalalRuleDefinition = {
  id: string;
  category: HalalScreeningRuleCategory;
  label: string;
  description: string;
};

const INTEREST_ACTIVITY_RULE: HalalRuleDefinition = {
  id: "interest-activity",
  category: "interest_based_activity",
  label: "Interest-based activity",
  description:
    "Exclude a structure when verified evidence shows that lending at interest or an equivalent interest-based return is a material primary activity.",
};
const PROHIBITED_INDUSTRY_RULE: HalalRuleDefinition = {
  id: "prohibited-industry",
  category: "prohibited_industry",
  label: "Prohibited industry exposure",
  description:
    "Exclude material exposure to screened sectors such as alcohol, gambling, pork, adult entertainment, tobacco, or conventional interest-based finance.",
};
const FINANCIAL_RATIO_RULE: HalalRuleDefinition = {
  id: "financial-ratios",
  category: "financial_ratio",
  label: "Financial ratios",
  description:
    "Compare verified interest-bearing debt and non-permissible income ratios with the configured preliminary thresholds.",
};
const ETHICAL_CONCERNS_RULE: HalalRuleDefinition = {
  id: "ethical-concerns",
  category: "ethical_concern",
  label: "Other ethical concerns",
  description:
    "Escalate substantiated concerns such as deception, exploitation, avoidable severe harm, opaque asset backing, or excessive contractual uncertainty.",
};

const RULES: HalalRuleDefinition[] = [
  INTEREST_ACTIVITY_RULE,
  PROHIBITED_INDUSTRY_RULE,
  FINANCIAL_RATIO_RULE,
  ETHICAL_CONCERNS_RULE,
];

export const HALAL_STATUS_DEFINITIONS: Record<HalalScreeningStatus, string> = {
  eligible:
    "All configured preliminary rules passed on dated, source-labeled evidence.",
  questionable:
    "No exclusion rule failed, but at least one evidence-backed concern requires qualified review.",
  excluded:
    "At least one configured exclusion rule failed on dated, source-labeled evidence.",
  insufficient_evidence:
    "The available record cannot support a decision across every configured rule.",
};

export function halalScreeningMethodology(
  config: HalalScreeningConfig = DEFAULT_HALAL_SCREENING_CONFIG,
) {
  return {
    version: HALAL_SCREENING_METHODOLOGY_VERSION,
    preliminaryOnly: true as const,
    ...config,
    rules: RULES.map((rule) => ({ ...rule })),
    statusDefinitions: { ...HALAL_STATUS_DEFINITIONS },
  };
}

function evidenceReferences(
  evidenceIds: string[],
  evidenceById: Map<string, OpportunityEvidence>,
) {
  return [...new Set(evidenceIds)]
    .map((id) => evidenceById.get(id))
    .filter((item): item is OpportunityEvidence => Boolean(item))
    .map((item) => ({
      evidenceId: item.id,
      sourceLabel: item.sourceLabel,
      observedAt: item.observedAt,
      synthetic: item.synthetic,
    }));
}

function evidenceBoundRule(
  rule: HalalRuleDefinition,
  signal: EvidenceBoundSignal,
  evidenceById: Map<string, OpportunityEvidence>,
): HalalScreeningRuleResult {
  const evidence = evidenceReferences(signal.evidenceIds, evidenceById);
  if (signal.outcome !== "not_assessed" && evidence.length === 0) {
    return {
      ruleId: rule.id,
      category: rule.category,
      label: rule.label,
      outcome: "not_assessed",
      explanation: `No dated, source-labeled evidence supports the proposed ${rule.label.toLowerCase()} decision.`,
      evidence: [],
    };
  }
  return {
    ruleId: rule.id,
    category: rule.category,
    label: rule.label,
    outcome: signal.outcome,
    explanation: signal.explanation,
    evidence,
  };
}

function financialRatioRule(
  input: HalalScreeningInput["financialRatios"],
  evidenceById: Map<string, OpportunityEvidence>,
  config: HalalScreeningConfig,
): HalalScreeningRuleResult {
  const rule = FINANCIAL_RATIO_RULE;
  const evidence = evidenceReferences(input.evidenceIds, evidenceById);
  if (
    input.interestBearingDebtPercent === null ||
    input.nonPermissibleIncomePercent === null ||
    evidence.length === 0
  ) {
    return {
      ruleId: rule.id,
      category: rule.category,
      label: rule.label,
      outcome: "not_assessed",
      explanation:
        "Verified interest-bearing debt and non-permissible income ratios are both required for this rule.",
      evidence,
    };
  }

  const debt = input.interestBearingDebtPercent;
  const income = input.nonPermissibleIncomePercent;
  const passed =
    debt <= config.interestBearingDebtMaximumPercent &&
    income <= config.nonPermissibleIncomeMaximumPercent;
  return {
    ruleId: rule.id,
    category: rule.category,
    label: rule.label,
    outcome: passed ? "passed" : "failed",
    explanation: passed
      ? `Reported interest-bearing debt (${debt}%) and non-permissible income (${income}%) are within the configured ${config.interestBearingDebtMaximumPercent}% and ${config.nonPermissibleIncomeMaximumPercent}% preliminary limits.`
      : `A reported ratio exceeds the configured preliminary limits: interest-bearing debt ${debt}% (maximum ${config.interestBearingDebtMaximumPercent}%) and non-permissible income ${income}% (maximum ${config.nonPermissibleIncomeMaximumPercent}%).`,
    evidence,
  };
}

function statusFor(results: HalalScreeningRuleResult[]): HalalScreeningStatus {
  if (results.some((result) => result.outcome === "failed")) return "excluded";
  if (results.some((result) => result.outcome === "review_required")) {
    return "questionable";
  }
  if (results.some((result) => result.outcome === "not_assessed")) {
    return "insufficient_evidence";
  }
  return "eligible";
}

export function screenOpportunity(
  input: HalalScreeningInput,
  evidence: OpportunityEvidence[],
  config: HalalScreeningConfig = DEFAULT_HALAL_SCREENING_CONFIG,
): HalalScreeningAssessment {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const ruleResults = [
    evidenceBoundRule(
      INTEREST_ACTIVITY_RULE,
      input.interestBasedActivity,
      evidenceById,
    ),
    evidenceBoundRule(
      PROHIBITED_INDUSTRY_RULE,
      input.prohibitedIndustry,
      evidenceById,
    ),
    financialRatioRule(input.financialRatios, evidenceById, config),
    evidenceBoundRule(
      ETHICAL_CONCERNS_RULE,
      input.ethicalConcerns,
      evidenceById,
    ),
  ];
  const status = statusFor(ruleResults);
  const decidedResults = ruleResults.filter(
    (result) => result.outcome !== "not_assessed",
  );
  const currentHistory: HalalScreeningHistoryEntry = {
    assessedAt: input.assessedAt,
    status,
    reason:
      decidedResults.map((result) => result.explanation).join(" ") ||
      "No rule had enough evidence for a screening decision.",
    methodologyVersion: HALAL_SCREENING_METHODOLOGY_VERSION,
    evidenceIds: [
      ...new Set(
        ruleResults.flatMap((result) =>
          result.evidence.map((item) => item.evidenceId),
        ),
      ),
    ],
    synthetic: input.synthetic,
  };
  const previousAssessments = input.previousAssessments ?? [];

  return {
    status,
    assessedAt: input.assessedAt,
    methodologyVersion: HALAL_SCREENING_METHODOLOGY_VERSION,
    rationale: decidedResults.map((result) => result.explanation),
    evidenceGaps: ruleResults
      .filter((result) => result.outcome === "not_assessed")
      .map((result) => result.label),
    ruleResults,
    history:
      previousAssessments.length > 0
        ? [...previousAssessments, currentHistory]
        : [],
    historyNote:
      previousAssessments.length > 0
        ? "Recorded assessment changes are shown in chronological order. Synthetic records remain explicitly labeled."
        : "No reliable prior assessment record is available; a change history is not inferred.",
    disclaimer: SCREENING_DISCLAIMER,
  };
}
