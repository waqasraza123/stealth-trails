import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpportunityHunter from "@/pages/OpportunityHunter";
import { renderWithRouter } from "@/test/render-with-router";
import { useUserStore } from "@/stores/userStore";
import type {
  HalalScreeningStatus,
  Opportunity,
  OpportunityHunterResponse,
  OpportunityRiskLevel,
} from "@/hooks/ai/useOpportunityHunter";

vi.mock("axios");
const mockAxios = vi.mocked(axios, true);

function buildOpportunity(
  id: string,
  name: string,
  score: number,
  riskLevel: OpportunityRiskLevel,
  halalStatus: HalalScreeningStatus,
  category: Opportunity["category"],
): Opportunity {
  return {
    id,
    name,
    symbol: id === "payments" ? "SYN-PAY" : "SYN-CRD",
    category,
    network: "Base",
    summary: `Synthetic summary for ${name}.`,
    thesis: `Synthetic thesis for ${name}.`,
    riskLevel,
    score,
    scoreLabel: score >= 80 ? "high_conviction_research" : "promising",
    scoreBreakdown: [
      {
        key: "fundamentals",
        label: "Fundamental strength",
        points: 24,
        maximum: 30,
        explanation: "80/100 synthetic fundamental signal × 30% weight.",
      },
    ],
    scenarios: [
      {
        kind: "upside",
        label: "Upside case",
        returnRangePercent: [20, 30],
        timeHorizonMonths: 18,
        assumptions: ["Adoption grows"],
      },
      {
        kind: "base",
        label: "Base case",
        returnRangePercent: [8, 14],
        timeHorizonMonths: 18,
        assumptions: ["Adoption is steady"],
      },
      {
        kind: "downside",
        label: "Downside case",
        returnRangePercent: [-25, -12],
        timeHorizonMonths: 18,
        assumptions: ["Adoption slows"],
      },
    ],
    evidence: [
      {
        id: `${id}-evidence-1`,
        title: "Adoption",
        finding: "Synthetic usage grew.",
        sourceLabel: "Synthetic Monitor",
        observedAt: "2026-10-15T12:00:00.000Z",
        synthetic: true,
      },
      {
        id: `${id}-evidence-2`,
        title: "Risk",
        finding: "Synthetic concentration remains material.",
        sourceLabel: "Synthetic Risk Lab",
        observedAt: "2026-10-15T12:00:00.000Z",
        synthetic: true,
      },
    ],
    halalScreening: {
      status: halalStatus,
      rationale: ["Screen based only on synthetic facts."],
      evidenceGaps: ["Independent review"],
      disclaimer: "This is not a fatwa, religious ruling, or certification.",
    },
    researchPlan: {
      objective: "Validate the synthetic thesis.",
      assumptions: ["All figures are synthetic"],
      researchSteps: ["Review the evidence"],
      monitoringSignals: ["Adoption"],
      exitConditions: ["Usage declines for two quarters"],
    },
    updatedAt: "2026-10-15T12:00:00.000Z",
    synthetic: true,
  };
}

function buildResponse(): OpportunityHunterResponse {
  return {
    dataset: {
      kind: "synthetic_research",
      label: "Synthetic research sandbox",
      asOf: "2026-10-15T12:00:00.000Z",
      methodologyVersion: "opportunity-score-v1",
      disclaimer: "All opportunities and market signals are simulated.",
    },
    scoringMethodology: {
      deterministic: true,
      summary: "Scores are calculated from fixed synthetic inputs.",
      formula: "Fundamentals + momentum + liquidity + evidence + risk.",
      maximumScore: 100,
    },
    ai: {
      analysisMode: "deterministic_rules",
      externalAiUsed: false,
      capabilities: {
        externalAiAvailable: false,
        providerName: null,
        model: null,
        disclosure: [],
      },
      boundaryNote:
        "External provider remains behind the existing disabled boundary.",
    },
    opportunities: [
      buildOpportunity(
        "payments",
        "Onchain Payments Index",
        84,
        "moderate",
        "eligible",
        "payments",
      ),
      buildOpportunity(
        "credit",
        "Stablecoin Credit Loop",
        62,
        "higher",
        "excluded",
        "income",
      ),
    ],
  };
}

describe("AI Opportunity Hunter page", () => {
  beforeEach(() => {
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "customer-a",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });
    mockAxios.get.mockResolvedValue({
      data: { status: "success", message: "ok", data: buildResponse() },
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useUserStore.setState({ token: null, user: null });
  });

  it("loads authenticated synthetic research and explains the execution boundary", async () => {
    renderWithRouter(<OpportunityHunter />, {
      initialEntries: ["/opportunities"],
    });

    expect(
      await screen.findByText("Onchain Payments Index"),
    ).toBeInTheDocument();
    expect(screen.getByText("Stablecoin Credit Loop")).toBeInTheDocument();
    expect(screen.getAllByText(/synthetic/i).length).toBeGreaterThan(2);
    expect(screen.getByText(/external ai not used/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("trade actions")).toBeInTheDocument();
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/ai/opportunities"),
      { headers: { Authorization: "Bearer test-token" } },
    );
  });

  it("filters and sorts opportunities in the customer dashboard", async () => {
    const user = userEvent.setup();
    renderWithRouter(<OpportunityHunter />, {
      initialEntries: ["/opportunities"],
    });
    await screen.findByText("Onchain Payments Index");

    await user.selectOptions(
      screen.getByLabelText("Filter by halal status"),
      "excluded",
    );
    expect(
      screen.queryByText("Onchain Payments Index"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Stablecoin Credit Loop")).toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    await user.type(screen.getByLabelText("Search research"), "payments");
    expect(screen.getByText("Onchain Payments Index")).toBeInTheDocument();
    expect(
      screen.queryByText("Stablecoin Credit Loop"),
    ).not.toBeInTheDocument();
  });

  it("opens an explainable detail view with scenarios, evidence, screening, and exit conditions", async () => {
    const user = userEvent.setup();
    renderWithRouter(<OpportunityHunter />, {
      initialEntries: ["/opportunities"],
    });
    const cardTitle = await screen.findByText("Onchain Payments Index");
    const card = cardTitle.closest("div.group");
    expect(card).not.toBeNull();

    await user.click(
      within(card as HTMLElement).getByRole("button", {
        name: /inspect research/i,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/why it scored 84/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Scenario range")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Supporting synthetic evidence"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Educational research plan"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Exit conditions")).toBeInTheDocument();
    expect(within(dialog).getByText(/not a fatwa/i)).toBeInTheDocument();
  });
});
