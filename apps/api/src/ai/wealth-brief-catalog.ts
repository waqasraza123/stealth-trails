import type {
  WealthBriefInterpretation,
  WealthBriefRiskFlag,
  WealthBriefSourceId,
  WealthSnapshot,
} from "./wealth-brief.types";

export type WealthBriefCatalogObservation = {
  id: string;
  text: string;
  sourceIds: WealthBriefSourceId[];
};

export type WealthBriefCatalogRiskFlag = {
  id: string;
  severity: WealthBriefRiskFlag["severity"];
  title: string;
  detail: string;
  sourceIds: WealthBriefSourceId[];
};

export type WealthBriefCatalogResearchQuestion = {
  id: string;
  text: string;
};

export type WealthBriefStatementCatalog = {
  observations: WealthBriefCatalogObservation[];
  riskFlags: WealthBriefCatalogRiskFlag[];
  researchQuestions: WealthBriefCatalogResearchQuestion[];
  observationById: ReadonlyMap<string, WealthBriefCatalogObservation>;
  riskFlagById: ReadonlyMap<string, WealthBriefCatalogRiskFlag>;
  researchQuestionById: ReadonlyMap<string, WealthBriefCatalogResearchQuestion>;
};

export type WealthBriefSelection = {
  observationIds: string[];
  riskFlagIds: string[];
  researchQuestionIds: string[];
};

function isPositiveDecimal(value: string): boolean {
  return !/^[-+]?0*(?:\.0*)?$/u.test(value.trim());
}

function assertEvidence(sourceIds: WealthBriefSourceId[], id: string): void {
  if (sourceIds.length === 0) {
    throw new Error(`Wealth brief catalog statement "${id}" has no evidence references.`);
  }
}

// The catalog is the only source of factual financial statements the model may
// present. Every entry is computed here from the deterministic snapshot, so
// balances, counts, statuses, severities, and source references are always
// server-verified. Sources that failed to load are represented explicitly and
// are never treated as zero-valued data.
export function buildWealthBriefStatementCatalog(
  snapshot: WealthSnapshot,
): WealthBriefStatementCatalog {
  const observations: WealthBriefCatalogObservation[] = [];
  const riskFlags: WealthBriefCatalogRiskFlag[] = [];

  for (const source of snapshot.sources) {
    if (source.status !== "unavailable") {
      continue;
    }
    riskFlags.push({
      id: `risk.source_unavailable.${source.id}`,
      severity: "info",
      title: `${source.label} unavailable`,
      detail:
        "This source could not be included. No conclusion was drawn from the missing data.",
      sourceIds: [source.id],
    });
  }

  if (snapshot.balances.length > 0) {
    observations.push({
      id: "obs.balances.count",
      text: `${snapshot.balances.length} asset balance record${snapshot.balances.length === 1 ? " is" : "s are"} available in this snapshot.`,
      sourceIds: ["balances"],
    });
  }
  if (snapshot.recentTransactions.length > 0) {
    observations.push({
      id: "obs.transactions.count",
      text: `${snapshot.recentTransactions.length} recent transaction record${snapshot.recentTransactions.length === 1 ? " is" : "s are"} included.`,
      sourceIds: ["transactions"],
    });
  }
  if (snapshot.stakingPositions.length > 0) {
    observations.push({
      id: "obs.staking.count",
      text: `${snapshot.stakingPositions.length} staking pool position${snapshot.stakingPositions.length === 1 ? " is" : "s are"} represented.`,
      sourceIds: ["staking"],
    });
  }
  if (snapshot.outstandingLoans.length > 0) {
    observations.push({
      id: "obs.loans.count",
      text: `${snapshot.outstandingLoans.length} loan${snapshot.outstandingLoans.length === 1 ? " has" : "s have"} a non-zero outstanding balance.`,
      sourceIds: ["loans"],
    });
  }
  if (snapshot.retirementVaults.length > 0) {
    observations.push({
      id: "obs.retirement_vaults.count",
      text: `${snapshot.retirementVaults.length} retirement vault position${snapshot.retirementVaults.length === 1 ? " is" : "s are"} included.`,
      sourceIds: ["retirement_vaults"],
    });
  }
  if (snapshot.solvency) {
    observations.push({
      id: "obs.solvency.status",
      text: `The latest included solvency snapshot is ${snapshot.solvency.status} with ${snapshot.solvency.evidenceFreshness} evidence.`,
      sourceIds: ["solvency"],
    });
  }

  if (snapshot.balances.some((balance) => isPositiveDecimal(balance.pendingBalance))) {
    riskFlags.push({
      id: "risk.balances.pending",
      severity: "info",
      title: "Pending balances present",
      detail:
        "At least one asset has a pending balance, so available and pending amounts should be reviewed separately.",
      sourceIds: ["balances"],
    });
  }

  const attentionTransactions = snapshot.recentTransactions.filter((transaction) =>
    ["failed", "review_required", "requested"].includes(transaction.status),
  );
  if (attentionTransactions.length > 0) {
    riskFlags.push({
      id: "risk.transactions.attention",
      severity: "warning",
      title: "Transactions need attention",
      detail: `${attentionTransactions.length} recent transaction record${attentionTransactions.length === 1 ? " has" : "s have"} a failed, requested, or review-required status.`,
      sourceIds: ["transactions"],
    });
  }

  const distressedLoans = snapshot.outstandingLoans.filter((loan) =>
    ["grace_period", "defaulted", "liquidation_review", "liquidating"].includes(
      loan.status,
    ),
  );
  if (distressedLoans.length > 0) {
    riskFlags.push({
      id: "risk.loans.distressed",
      severity: "critical",
      title: "Loan servicing status requires review",
      detail: `${distressedLoans.length} outstanding loan${distressedLoans.length === 1 ? " is" : "s are"} in grace, default, or liquidation workflow.`,
      sourceIds: ["loans"],
    });
  }

  if (
    snapshot.stakingPositions.some(
      (position) => !position.canReadPosition && isPositiveDecimal(position.stakedBalance),
    )
  ) {
    riskFlags.push({
      id: "risk.staking.unreadable",
      severity: "warning",
      title: "Staking position read is incomplete",
      detail:
        "A recorded staking position could not be verified through the configured chain read model.",
      sourceIds: ["staking"],
    });
  }

  if (
    snapshot.solvency &&
    (snapshot.solvency.status !== "healthy" ||
      snapshot.solvency.evidenceFreshness !== "fresh" ||
      snapshot.solvency.policyActionsTriggered)
  ) {
    riskFlags.push({
      id: "risk.solvency.review",
      severity: snapshot.solvency.status === "critical" ? "critical" : "warning",
      title: "Solvency status should be reviewed",
      detail:
        "The included solvency status, evidence freshness, or policy-action state is not fully clear and healthy.",
      sourceIds: ["solvency"],
    });
  }

  const researchQuestions: WealthBriefCatalogResearchQuestion[] = [
    {
      id: "research.balances.availability",
      text: "Which balances are currently available versus pending, and why?",
    },
    {
      id: "research.transactions.settlement",
      text: "Which recent transactions are still unsettled or require review?",
    },
    {
      id: "research.loans.servicing",
      text: "What are the next due dates and current servicing states of outstanding loans?",
    },
    {
      id: "research.retirement_vaults.unlock",
      text: "When do retirement vault positions unlock, and which release rules apply?",
    },
    {
      id: "research.solvency.freshness",
      text: "How current is the latest solvency evidence for each represented asset?",
    },
  ];

  for (const observation of observations) {
    assertEvidence(observation.sourceIds, observation.id);
  }
  for (const riskFlag of riskFlags) {
    assertEvidence(riskFlag.sourceIds, riskFlag.id);
  }

  return {
    observations,
    riskFlags,
    researchQuestions,
    observationById: new Map(observations.map((entry) => [entry.id, entry])),
    riskFlagById: new Map(riskFlags.map((entry) => [entry.id, entry])),
    researchQuestionById: new Map(
      researchQuestions.map((entry) => [entry.id, entry]),
    ),
  };
}

function buildSnapshotSummary(snapshot: WealthSnapshot): string {
  const unavailableSources = snapshot.sources.filter(
    (source) => source.status === "unavailable",
  );
  return `This brief contains ${snapshot.balances.length} balance record(s), ${snapshot.recentTransactions.length} recent transaction record(s), ${snapshot.stakingPositions.length} staking position(s), ${snapshot.outstandingLoans.length} outstanding loan(s), and ${snapshot.retirementVaults.length} retirement vault position(s). ${unavailableSources.length} source(s) were unavailable.`;
}

// Deterministic preview: the full eligible catalog, rendered without any
// model involvement.
export function renderCatalogInterpretation(
  snapshot: WealthSnapshot,
  catalog: WealthBriefStatementCatalog,
): WealthBriefInterpretation {
  return {
    summary: buildSnapshotSummary(snapshot),
    observations: catalog.observations
      .slice(0, 6)
      .map(({ text, sourceIds }) => ({ text, sourceIds })),
    riskFlags: catalog.riskFlags
      .slice(0, 6)
      .map(({ severity, title, detail, sourceIds }) => ({
        severity,
        title,
        detail,
        sourceIds,
      })),
    researchQuestions: catalog.researchQuestions.map(({ text }) => text),
  };
}

// AI-prioritized brief: the model only selected and ordered catalog entries.
// All displayed text, values, severities, and source references are rendered
// here from server-verified catalog data; no model-authored financial text is
// shown.
export function renderSelectedInterpretation(
  snapshot: WealthSnapshot,
  catalog: WealthBriefStatementCatalog,
  selection: WealthBriefSelection,
): WealthBriefInterpretation {
  const observations = selection.observationIds.map((id) => {
    const entry = catalog.observationById.get(id);
    if (!entry) {
      throw new Error(`Wealth brief selection references unknown observation "${id}".`);
    }
    return { text: entry.text, sourceIds: entry.sourceIds };
  });

  const riskFlags = selection.riskFlagIds.map((id) => {
    const entry = catalog.riskFlagById.get(id);
    if (!entry) {
      throw new Error(`Wealth brief selection references unknown risk flag "${id}".`);
    }
    return {
      severity: entry.severity,
      title: entry.title,
      detail: entry.detail,
      sourceIds: entry.sourceIds,
    };
  });

  const researchQuestions = selection.researchQuestionIds.map((id) => {
    const entry = catalog.researchQuestionById.get(id);
    if (!entry) {
      throw new Error(`Wealth brief selection references unknown research question "${id}".`);
    }
    return entry.text;
  });

  return {
    summary: `${buildSnapshotSummary(snapshot)} The external model prioritized ${observations.length} observation(s), ${riskFlags.length} risk flag(s), and ${researchQuestions.length} research question(s) from the server-verified statement catalog; every statement below is rendered by the backend from verified snapshot data.`,
    observations,
    riskFlags,
    researchQuestions,
  };
}
