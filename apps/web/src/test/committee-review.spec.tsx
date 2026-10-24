import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommitteeReview } from "@/pages/InvestmentCommittee";

afterEach(cleanup);

describe("committee evidence review", () => {
  it("shows specialist challenges and what must change before reassessment", () => {
    render(<CommitteeReview review={{
      methodology: "cross_agent_evidence_review_v1", conclusion: "review_required",
      summary: "The scenario exceeds the research mandate.",
      challenges: [{ id: "risk_tolerance", reviewer: "risk-agent", target: "strategy-agent", severity: "high", reason: "Weighted risk exceeds the stated tolerance.", evidenceIds: ["risk-evidence"], reassessmentCondition: "Model an alternative within the stated tolerance." }],
      nextResearchSteps: ["Compare the alternative's stress results."],
    }} />);
    expect(screen.getByRole("region", { name: "Cross-agent evidence review" })).toBeInTheDocument();
    expect(screen.getByText("Review Required")).toBeInTheDocument();
    expect(screen.getByText("Weighted risk exceeds the stated tolerance.")).toBeInTheDocument();
    expect(screen.getByText(/Risk Agent → Strategy Agent/)).toBeInTheDocument();
    expect(screen.getByText(/Model an alternative within the stated tolerance/)).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Compare the alternative's stress results.");
  });
});
