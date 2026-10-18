import type {
  HalalScreeningStatus,
  OpportunityRiskLevel,
} from "./opportunity-hunter.types";

export type WeightedAllocation = {
  percent: number;
  riskLevel: OpportunityRiskLevel;
  halalStatus: HalalScreeningStatus;
};

export const RISK_VALUES: Record<OpportunityRiskLevel, number> = {
  lower: 1,
  moderate: 2,
  higher: 3,
};

export function roundRiskValue(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateWeightedRisk(
  allocations: WeightedAllocation[],
): { score: number; label: OpportunityRiskLevel } {
  const score = roundRiskValue(
    allocations.reduce(
      (total, allocation) =>
        total +
        RISK_VALUES[allocation.riskLevel] * (allocation.percent / 100),
      0,
    ),
  );
  return {
    score,
    label: score < 1.67 ? "lower" : score < 2.34 ? "moderate" : "higher",
  };
}

export function calculateDiversification(allocations: WeightedAllocation[]): {
  score: number;
  concentrationIndex: number;
  effectiveAssetCount: number;
  maximumWeight: number;
} {
  const rawConcentration = allocations.reduce(
    (total, allocation) => total + (allocation.percent / 100) ** 2,
    0,
  );
  const concentrationIndex = roundRiskValue(rawConcentration);
  const score =
    allocations.length <= 1
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((1 - rawConcentration) / (1 - 1 / allocations.length)) * 100,
            ),
          ),
        );
  return {
    score,
    concentrationIndex,
    effectiveAssetCount:
      rawConcentration > 0 ? roundRiskValue(1 / rawConcentration) : 0,
    maximumWeight: Math.max(...allocations.map((item) => item.percent), 0),
  };
}

export function calculateHalalWeights(
  allocations: WeightedAllocation[],
): {
  statusWeights: Record<HalalScreeningStatus, number>;
  overallStatus: HalalScreeningStatus;
} {
  const statusWeights: Record<HalalScreeningStatus, number> = {
    eligible: 0,
    questionable: 0,
    excluded: 0,
    insufficient_evidence: 0,
  };
  for (const allocation of allocations) {
    statusWeights[allocation.halalStatus] = roundRiskValue(
      statusWeights[allocation.halalStatus] + allocation.percent,
    );
  }
  return {
    statusWeights,
    overallStatus:
      statusWeights.excluded > 0
        ? "excluded"
        : statusWeights.questionable > 0
          ? "questionable"
          : statusWeights.insufficient_evidence > 0
            ? "insufficient_evidence"
            : "eligible",
  };
}
