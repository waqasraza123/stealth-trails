import {
  DEFAULT_HALAL_SCREENING_CONFIG,
  screenOpportunity,
  type HalalScreeningConfig,
  type HalalScreeningInput,
} from "./halal-screening.engine";
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityRiskLevel,
  OpportunityScoreInputs,
} from "./opportunity-hunter.types";

type OpportunitySeed = Omit<
  Opportunity,
  | "score"
  | "scoreLabel"
  | "scoreBreakdown"
  | "synthetic"
  | "marketData"
  | "halalScreening"
> & {
  scoreInputs: OpportunityScoreInputs;
  screeningInput: HalalScreeningInput;
};

const RISK_POINTS: Record<OpportunityRiskLevel, number> = {
  lower: 20,
  moderate: 14,
  higher: 7,
};

const clamp = (value: number): number => Math.max(0, Math.min(100, value));
const weightedPoints = (value: number, maximum: number): number =>
  Math.round((clamp(value) / 100) * maximum);

export function scoreOpportunity(
  inputs: OpportunityScoreInputs,
  riskLevel: OpportunityRiskLevel,
): Pick<Opportunity, "score" | "scoreLabel" | "scoreBreakdown"> {
  const scoreBreakdown: Opportunity["scoreBreakdown"] = [
    {
      key: "fundamentals",
      label: "Fundamental strength",
      points: weightedPoints(inputs.fundamentals, 30),
      maximum: 30,
      explanation: `${clamp(inputs.fundamentals)}/100 synthetic fundamental signal × 30% weight.`,
    },
    {
      key: "momentum",
      label: "Adoption momentum",
      points: weightedPoints(inputs.momentum, 20),
      maximum: 20,
      explanation: `${clamp(inputs.momentum)}/100 synthetic adoption signal × 20% weight.`,
    },
    {
      key: "liquidity",
      label: "Liquidity resilience",
      points: weightedPoints(inputs.liquidity, 15),
      maximum: 15,
      explanation: `${clamp(inputs.liquidity)}/100 synthetic liquidity signal × 15% weight.`,
    },
    {
      key: "evidence",
      label: "Evidence quality",
      points: weightedPoints(inputs.evidenceQuality, 15),
      maximum: 15,
      explanation: `${clamp(inputs.evidenceQuality)}/100 evidence-completeness signal × 15% weight.`,
    },
    {
      key: "risk",
      label: "Risk adjustment",
      points: RISK_POINTS[riskLevel],
      maximum: 20,
      explanation: `${riskLevel} risk receives ${RISK_POINTS[riskLevel]}/20 under the fixed risk table.`,
    },
  ];
  const score = scoreBreakdown.reduce(
    (total, component) => total + component.points,
    0,
  );

  return {
    score,
    scoreLabel:
      score >= 80
        ? "high_conviction_research"
        : score >= 65
          ? "promising"
          : "developing",
    scoreBreakdown,
  };
}

function evidence(
  id: string,
  title: string,
  finding: string,
  sourceLabel: string,
): OpportunitySeed["evidence"][number] {
  return {
    id,
    title,
    finding,
    sourceLabel,
    observedAt: "2026-10-15T12:00:00.000Z",
    synthetic: true,
  };
}

const plan = (
  objective: string,
  assumptions: string[],
  researchSteps: string[],
  monitoringSignals: string[],
  exitConditions: string[],
): OpportunitySeed["researchPlan"] => ({
  objective,
  assumptions,
  riskConsiderations: exitConditions,
  ethicalConsiderations: [
    "Treat the preliminary halal screen as research, not religious certification.",
    "Resolve every screening evidence gap and review material structural changes before considering action.",
  ],
  researchSteps,
  monitoringSignals,
  exitConditions,
});

const seeds: OpportunitySeed[] = [
  {
    id: "syn-eth-validator-infrastructure",
    name: "Validator Infrastructure Basket",
    symbol: "SYN-VAL",
    category: "infrastructure",
    network: "Ethereum",
    summary:
      "A simulated basket tracking validator tooling, monitoring, and resilient node infrastructure.",
    thesis:
      "Validator demand could reward infrastructure with durable usage and diversified operator revenue.",
    riskLevel: "moderate",
    scoreInputs: {
      fundamentals: 88,
      momentum: 76,
      liquidity: 72,
      evidenceQuality: 86,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Adoption accelerates",
        returnRangePercent: [24, 38],
        timeHorizonMonths: 18,
        assumptions: [
          "Validator participation rises",
          "Fee compression remains orderly",
        ],
      },
      {
        kind: "base",
        label: "Steady infrastructure demand",
        returnRangePercent: [8, 16],
        timeHorizonMonths: 18,
        assumptions: [
          "Network activity grows gradually",
          "Operators retain pricing power",
        ],
      },
      {
        kind: "downside",
        label: "Commoditization pressure",
        returnRangePercent: [-28, -14],
        timeHorizonMonths: 18,
        assumptions: [
          "Tooling becomes interchangeable",
          "Protocol changes reduce margins",
        ],
      },
    ],
    evidence: [
      evidence(
        "val-1",
        "Validator participation",
        "Simulated active validators increased 11% over two quarters.",
        "Synthetic Network Monitor",
      ),
      evidence(
        "val-2",
        "Operator revenue quality",
        "Simulated recurring revenue share reached 68% across the basket.",
        "Synthetic Issuer Filings",
      ),
      evidence(
        "val-3",
        "Client concentration",
        "The top two clients represent a simulated 41% of revenue.",
        "Synthetic Risk Lab",
      ),
      evidence(
        "val-screen",
        "Preliminary activity and ratio screen",
        "Synthetic records show no conventional interest lending or prohibited-sector revenue, 4% interest-bearing debt, and 1% non-permissible income; staking reward and penalty terms remain structurally uncertain.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "passed",
        explanation:
          "Synthetic revenue records show infrastructure services rather than conventional interest lending as the primary activity.",
        evidenceIds: ["val-screen"],
      },
      prohibitedIndustry: {
        outcome: "passed",
        explanation:
          "The synthetic revenue record reports no material prohibited-sector exposure.",
        evidenceIds: ["val-screen"],
      },
      financialRatios: {
        interestBearingDebtPercent: 4,
        nonPermissibleIncomePercent: 1,
        evidenceIds: ["val-screen"],
      },
      ethicalConcerns: {
        outcome: "review_required",
        explanation:
          "Staking reward, penalty, and custody terms remain structurally uncertain and require qualified review.",
        evidenceIds: ["val-screen"],
      },
      previousAssessments: [
        {
          assessedAt: "2026-09-15T12:00:00.000Z",
          status: "insufficient_evidence",
          reason:
            "The earlier synthetic record did not include an activity-and-ratio workbook.",
          methodologyVersion: "preliminary-halal-screen-v1",
          evidenceIds: ["val-1"],
          synthetic: true,
        },
      ],
    },
    researchPlan: plan(
      "Test whether validator infrastructure demand can support durable, non-custodial revenue.",
      [
        "All performance figures are synthetic",
        "No leverage is assumed",
        "An 18-month research horizon is used",
      ],
      [
        "Review each constituent revenue model",
        "Stress-test revenue at 30% lower validator growth",
        "Verify smart-contract and custody dependencies",
      ],
      [
        "Validator count",
        "Recurring revenue share",
        "Client concentration",
        "Critical software incidents",
      ],
      [
        "Two consecutive quarters of declining usage",
        "Critical security failure without a verified remediation",
        "Non-permissible revenue exceeds the chosen screening threshold",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "syn-tokenized-sukuk-sandbox",
    name: "Tokenized Sukuk Sandbox",
    symbol: "SYN-SUK",
    category: "income",
    network: "Base",
    summary:
      "A simulated asset-backed certificate pilot tied to leased renewable-energy equipment.",
    thesis:
      "Transparent asset backing and programmable distributions may improve access to real-economy financing.",
    riskLevel: "lower",
    scoreInputs: {
      fundamentals: 82,
      momentum: 58,
      liquidity: 49,
      evidenceQuality: 91,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Pilot scales",
        returnRangePercent: [10, 15],
        timeHorizonMonths: 24,
        assumptions: [
          "Equipment utilization stays above 90%",
          "Secondary liquidity improves",
        ],
      },
      {
        kind: "base",
        label: "Distributions track plan",
        returnRangePercent: [5, 8],
        timeHorizonMonths: 24,
        assumptions: [
          "Lease payments remain current",
          "Token servicing remains operational",
        ],
      },
      {
        kind: "downside",
        label: "Asset or servicing disruption",
        returnRangePercent: [-12, -4],
        timeHorizonMonths: 24,
        assumptions: [
          "Equipment utilization falls",
          "Secondary market remains thin",
        ],
      },
    ],
    evidence: [
      evidence(
        "suk-1",
        "Asset register",
        "Synthetic records show identifiable equipment backing each certificate.",
        "Synthetic Asset Registry",
      ),
      evidence(
        "suk-2",
        "Distribution coverage",
        "Simulated lease cash flow covers planned distributions by 1.35×.",
        "Synthetic Servicer Report",
      ),
      evidence(
        "suk-3",
        "Liquidity depth",
        "Simulated secondary volume remains below the research threshold.",
        "Synthetic Market Tape",
      ),
      evidence(
        "suk-screen",
        "Preliminary activity and ratio screen",
        "Synthetic records describe equipment-lease income, no prohibited-sector exposure, 8% interest-bearing debt, 1% non-permissible income, and identifiable asset backing.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "passed",
        explanation:
          "The synthetic structure reports equipment-lease income rather than stated interest as its return source.",
        evidenceIds: ["suk-screen"],
      },
      prohibitedIndustry: {
        outcome: "passed",
        explanation:
          "The synthetic activity record reports no material prohibited-sector exposure.",
        evidenceIds: ["suk-screen"],
      },
      financialRatios: {
        interestBearingDebtPercent: 8,
        nonPermissibleIncomePercent: 1,
        evidenceIds: ["suk-screen"],
      },
      ethicalConcerns: {
        outcome: "passed",
        explanation:
          "The synthetic asset register identifies equipment backing and does not report a material ethical concern under the configured rule.",
        evidenceIds: ["suk-1", "suk-screen"],
      },
      previousAssessments: [
        {
          assessedAt: "2026-08-15T12:00:00.000Z",
          status: "questionable",
          reason:
            "Asset backing had not yet been connected to itemized synthetic registry records.",
          methodologyVersion: "preliminary-halal-screen-v1",
          evidenceIds: ["suk-2"],
          synthetic: true,
        },
      ],
    },
    researchPlan: plan(
      "Validate asset ownership, lease economics, and distribution resilience before further consideration.",
      [
        "Asset and lease records are synthetic",
        "Certificates are held to the stated 24-month horizon",
        "No secondary-market exit is guaranteed",
      ],
      [
        "Trace certificate claims to each asset",
        "Review lease and default provisions",
        "Model a 20% utilization decline",
      ],
      [
        "Lease collection rate",
        "Asset utilization",
        "Distribution coverage",
        "Secondary-market depth",
      ],
      [
        "Asset backing cannot be independently verified",
        "Lease collection drops below 85%",
        "Structure changes to an interest-bearing obligation",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "syn-stablecoin-credit-loop",
    name: "Stablecoin Credit Loop",
    symbol: "SYN-CRD",
    category: "income",
    network: "Multi-chain",
    summary:
      "A simulated lending strategy earning variable yield from overcollateralized stablecoin loans.",
    thesis:
      "Borrow demand may sustain yield, but the return source and liquidation path create material screening concerns.",
    riskLevel: "higher",
    scoreInputs: {
      fundamentals: 61,
      momentum: 70,
      liquidity: 78,
      evidenceQuality: 80,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Credit demand expands",
        returnRangePercent: [14, 22],
        timeHorizonMonths: 12,
        assumptions: [
          "Borrow utilization remains high",
          "No major depeg occurs",
        ],
      },
      {
        kind: "base",
        label: "Yield normalizes",
        returnRangePercent: [5, 10],
        timeHorizonMonths: 12,
        assumptions: [
          "Rates decline gradually",
          "Liquidations remain contained",
        ],
      },
      {
        kind: "downside",
        label: "Depeg and bad debt",
        returnRangePercent: [-36, -18],
        timeHorizonMonths: 12,
        assumptions: [
          "Collateral gaps emerge",
          "Liquidity fragments during stress",
        ],
      },
    ],
    evidence: [
      evidence(
        "crd-1",
        "Yield source",
        "Simulated returns are primarily paid by borrowers as interest.",
        "Synthetic Protocol Cash-flow Map",
      ),
      evidence(
        "crd-2",
        "Stress liquidity",
        "Simulated executable depth falls 63% during a depeg scenario.",
        "Synthetic Market Stress Test",
      ),
      evidence(
        "crd-screen",
        "Preliminary activity and ratio screen",
        "Synthetic records identify lending interest as the primary return source, no separate prohibited-sector exposure, 18% interest-bearing debt, and 82% interest-derived income.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "failed",
        explanation:
          "The simulated strategy's primary return is explicitly interest paid by borrowers.",
        evidenceIds: ["crd-1", "crd-screen"],
      },
      prohibitedIndustry: {
        outcome: "passed",
        explanation:
          "The synthetic record reports no separate prohibited-sector exposure beyond the failed interest-based activity rule.",
        evidenceIds: ["crd-screen"],
      },
      financialRatios: {
        interestBearingDebtPercent: 18,
        nonPermissibleIncomePercent: 82,
        evidenceIds: ["crd-screen"],
      },
      ethicalConcerns: {
        outcome: "review_required",
        explanation:
          "Depeg liquidation mechanics and severe stress-liquidity deterioration require ethical and risk review.",
        evidenceIds: ["crd-2"],
      },
    },
    researchPlan: plan(
      "Understand the risk mechanics and exclusion rationale; this is not an implementation plan.",
      [
        "The protocol and results are fictional",
        "No deposit or allocation is contemplated",
      ],
      [
        "Map yield sources",
        "Review liquidation sequencing",
        "Compare depeg stress outcomes",
      ],
      [
        "Borrow utilization",
        "Bad debt",
        "Stablecoin deviation",
        "Liquidity concentration",
      ],
      [
        "Interest-based structure remains unchanged",
        "Bad debt appears",
        "A supported stablecoin loses its peg beyond the research tolerance",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "syn-onchain-payments-index",
    name: "Onchain Payments Index",
    symbol: "SYN-PAY",
    category: "payments",
    network: "Base",
    summary:
      "A simulated index of fee-based payment routing, settlement, and merchant tooling providers.",
    thesis:
      "Growing settlement volume may benefit providers with usage-based fees and strong merchant retention.",
    riskLevel: "moderate",
    scoreInputs: {
      fundamentals: 79,
      momentum: 91,
      liquidity: 81,
      evidenceQuality: 76,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Merchant adoption compounds",
        returnRangePercent: [28, 44],
        timeHorizonMonths: 18,
        assumptions: ["Payment volume doubles", "Take rates remain stable"],
      },
      {
        kind: "base",
        label: "Volume grows steadily",
        returnRangePercent: [9, 19],
        timeHorizonMonths: 18,
        assumptions: [
          "Merchant retention exceeds 80%",
          "Competition trims take rates",
        ],
      },
      {
        kind: "downside",
        label: "Margins compress",
        returnRangePercent: [-31, -12],
        timeHorizonMonths: 18,
        assumptions: ["Fee competition intensifies", "Regulatory costs rise"],
      },
    ],
    evidence: [
      evidence(
        "pay-1",
        "Settlement volume",
        "Simulated quarterly payment volume grew 27%.",
        "Synthetic Payments Observatory",
      ),
      evidence(
        "pay-2",
        "Merchant retention",
        "Simulated twelve-month merchant retention is 84%.",
        "Synthetic Cohort Report",
      ),
      evidence(
        "pay-3",
        "Fee pressure",
        "Simulated blended take rate declined 9% year over year.",
        "Synthetic Market Tape",
      ),
      evidence(
        "pay-screen",
        "Preliminary activity and ratio screen",
        "Synthetic records attribute revenue to payment-service fees, report no prohibited-sector exposure, 3% interest-bearing debt, 0.5% non-permissible income, and no substantiated material ethical concern.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "passed",
        explanation:
          "The synthetic record attributes primary revenue to payment-service and transaction fees rather than interest lending.",
        evidenceIds: ["pay-screen"],
      },
      prohibitedIndustry: {
        outcome: "passed",
        explanation:
          "The synthetic constituent record reports no material prohibited-sector exposure.",
        evidenceIds: ["pay-screen"],
      },
      financialRatios: {
        interestBearingDebtPercent: 3,
        nonPermissibleIncomePercent: 0.5,
        evidenceIds: ["pay-screen"],
      },
      ethicalConcerns: {
        outcome: "passed",
        explanation:
          "The dated synthetic screening record reports no substantiated material ethical concern under the configured rule.",
        evidenceIds: ["pay-screen"],
      },
    },
    researchPlan: plan(
      "Determine whether transaction growth can outpace take-rate compression.",
      [
        "Volume and retention data are synthetic",
        "No multiple expansion is assumed in the base case",
      ],
      [
        "Reconcile volume to fee revenue",
        "Review constituent business activities",
        "Model a 25% take-rate decline",
      ],
      [
        "Payment volume",
        "Merchant retention",
        "Take rate",
        "Regulatory cost per transaction",
      ],
      [
        "Merchant retention falls below 70%",
        "Two quarters of negative payment growth",
        "Material prohibited revenue is identified",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "syn-private-identity-layer",
    name: "Private Identity Layer",
    symbol: "SYN-ID",
    category: "privacy",
    network: "Ethereum L2",
    summary:
      "A simulated zero-knowledge identity network for selective disclosure and compliant account access.",
    thesis:
      "Demand for privacy-preserving verification could grow as institutions adopt public networks.",
    riskLevel: "higher",
    scoreInputs: {
      fundamentals: 70,
      momentum: 84,
      liquidity: 44,
      evidenceQuality: 48,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Standards adoption",
        returnRangePercent: [35, 58],
        timeHorizonMonths: 24,
        assumptions: ["Two major platforms integrate", "Proof costs decline"],
      },
      {
        kind: "base",
        label: "Developer adoption",
        returnRangePercent: [6, 18],
        timeHorizonMonths: 24,
        assumptions: [
          "Integrations remain experimental",
          "Funding supports continued development",
        ],
      },
      {
        kind: "downside",
        label: "Adoption stalls",
        returnRangePercent: [-48, -24],
        timeHorizonMonths: 24,
        assumptions: ["Standards fragment", "Token utility remains unclear"],
      },
    ],
    evidence: [
      evidence(
        "id-1",
        "Developer activity",
        "Simulated monthly active developers increased from 38 to 61.",
        "Synthetic Developer Graph",
      ),
      evidence(
        "id-2",
        "Token utility gap",
        "Synthetic documentation does not establish durable token demand.",
        "Synthetic Protocol Review",
      ),
      evidence(
        "id-screen",
        "Partial activity screen",
        "Synthetic documentation identifies privacy-preserving identity tooling as the core activity but omits customer-sector revenue, debt, non-permissible income, treasury, and misuse-control records.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "passed",
        explanation:
          "The available synthetic purpose statement describes identity tooling rather than interest lending as the core activity.",
        evidenceIds: ["id-screen"],
      },
      prohibitedIndustry: {
        outcome: "not_assessed",
        explanation:
          "Customer-sector and revenue composition evidence is unavailable.",
        evidenceIds: [],
      },
      financialRatios: {
        interestBearingDebtPercent: null,
        nonPermissibleIncomePercent: null,
        evidenceIds: [],
      },
      ethicalConcerns: {
        outcome: "not_assessed",
        explanation:
          "Misuse controls, treasury practices, and token distribution contracts are unavailable.",
        evidenceIds: ["id-screen"],
      },
    },
    researchPlan: plan(
      "Establish whether real usage and token economics can justify continued research.",
      [
        "Developer and integration figures are synthetic",
        "Token demand is not inferred from protocol usage",
      ],
      [
        "Separate protocol usage from token demand",
        "Review treasury and token distribution",
        "Assess regulatory treatment by target market",
      ],
      [
        "Production integrations",
        "Proof-generation cost",
        "Developer retention",
        "Treasury runway",
      ],
      [
        "Token utility remains unverified after the next research checkpoint",
        "Developer retention falls below 50%",
        "A critical privacy vulnerability is disclosed",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "syn-restaking-security-market",
    name: "Restaking Security Market",
    symbol: "SYN-RST",
    category: "security",
    network: "Ethereum",
    summary:
      "A simulated marketplace for pooled cryptoeconomic security across middleware services.",
    thesis:
      "Shared security could lower launch costs, while correlated slashing and incentive complexity remain central risks.",
    riskLevel: "higher",
    scoreInputs: {
      fundamentals: 75,
      momentum: 89,
      liquidity: 69,
      evidenceQuality: 72,
    },
    scenarios: [
      {
        kind: "upside",
        label: "Service demand broadens",
        returnRangePercent: [32, 52],
        timeHorizonMonths: 18,
        assumptions: [
          "Secured services diversify",
          "Slashing remains isolated",
        ],
      },
      {
        kind: "base",
        label: "Measured expansion",
        returnRangePercent: [7, 17],
        timeHorizonMonths: 18,
        assumptions: [
          "Demand grows with conservative caps",
          "Reward rates normalize",
        ],
      },
      {
        kind: "downside",
        label: "Correlated slashing event",
        returnRangePercent: [-55, -29],
        timeHorizonMonths: 18,
        assumptions: [
          "A shared dependency fails",
          "Withdrawals become congested",
        ],
      },
    ],
    evidence: [
      evidence(
        "rst-1",
        "Secured service growth",
        "Simulated secured services grew from 8 to 19 in two quarters.",
        "Synthetic Security Market Monitor",
      ),
      evidence(
        "rst-2",
        "Dependency overlap",
        "A simulated 57% of value shares the same operator cluster.",
        "Synthetic Correlation Study",
      ),
      evidence(
        "rst-3",
        "Slashing history",
        "No simulated loss event has yet tested the full withdrawal path.",
        "Synthetic Incident Registry",
      ),
      evidence(
        "rst-screen",
        "Preliminary activity and ratio screen",
        "Synthetic records describe security-service fees rather than lending, no prohibited-sector revenue, 6% interest-bearing debt, and 2% non-permissible income; reward, rehypothecation, and penalty terms remain structurally complex.",
        "Synthetic Compliance Workbook",
      ),
    ],
    screeningInput: {
      assessedAt: "2026-10-15T12:00:00.000Z",
      synthetic: true,
      interestBasedActivity: {
        outcome: "passed",
        explanation:
          "The synthetic record identifies cryptoeconomic security-service fees rather than conventional interest lending as the primary activity.",
        evidenceIds: ["rst-screen"],
      },
      prohibitedIndustry: {
        outcome: "passed",
        explanation:
          "The synthetic revenue record reports no material prohibited-sector exposure.",
        evidenceIds: ["rst-screen"],
      },
      financialRatios: {
        interestBearingDebtPercent: 6,
        nonPermissibleIncomePercent: 2,
        evidenceIds: ["rst-screen"],
      },
      ethicalConcerns: {
        outcome: "review_required",
        explanation:
          "Reward, rehypothecation, correlated slashing, and penalty terms remain structurally complex and require qualified review.",
        evidenceIds: ["rst-2", "rst-3", "rst-screen"],
      },
      previousAssessments: [
        {
          assessedAt: "2026-08-15T12:00:00.000Z",
          status: "eligible",
          reason:
            "The earlier synthetic assessment did not include the later dependency-overlap and untested-slashing evidence.",
          methodologyVersion: "preliminary-halal-screen-v1",
          evidenceIds: ["rst-1"],
          synthetic: true,
        },
      ],
    },
    researchPlan: plan(
      "Assess whether service diversification compensates for correlated slashing risk.",
      [
        "All adoption and operator data are synthetic",
        "No recursive leverage is assumed in the base case",
      ],
      [
        "Map shared dependencies",
        "Simulate simultaneous operator failures",
        "Trace every reward source",
      ],
      [
        "Operator concentration",
        "Value at risk",
        "Withdrawal latency",
        "Secured-service diversity",
      ],
      [
        "Operator concentration exceeds 65%",
        "Unbounded recursive exposure is introduced",
        "A material slashing event reveals unrecoverable accounting gaps",
      ],
    ),
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
];

export function buildSyntheticOpportunityCatalog(
  screeningConfig: HalalScreeningConfig = DEFAULT_HALAL_SCREENING_CONFIG,
): Opportunity[] {
  return seeds.map(({ scoreInputs, screeningInput, ...seed }) => ({
    ...seed,
    ...scoreOpportunity(scoreInputs, seed.riskLevel),
    halalScreening: screenOpportunity(
      screeningInput,
      seed.evidence,
      screeningConfig,
    ),
    marketData: null,
    synthetic: true,
  }));
}

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  "infrastructure",
  "income",
  "payments",
  "privacy",
  "security",
];
