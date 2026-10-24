import { ChatOpenAI } from "@langchain/openai";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { InvestmentCommitteeLlmService, prioritizeCommitteeFindings, validateCommitteeRanking } from "./investment-committee.llm.service";

jest.mock("@langchain/openai", () => ({ ChatOpenAI: jest.fn() }));

const findings = [
  { id: "opportunity", category: "opportunity", evidenceStatus: "verified", evidenceCount: 3, challengeCodes: [] },
  { id: "screen", category: "halal", evidenceStatus: "mixed", evidenceCount: 1, challengeCodes: ["screening"] },
  { id: "risk", category: "risk", evidenceStatus: "verified", evidenceCount: 2, challengeCodes: ["risk_tolerance"] },
];

describe("committee reasoning prioritization", () => {
  it("surfaces unresolved challenges before attractive opportunities without an LLM", async () => {
    expect(prioritizeCommitteeFindings(findings)).toEqual(["screen", "risk", "opportunity"]);
    const service = new InvestmentCommitteeLlmService();
    jest.spyOn(service, "isAvailable").mockReturnValue(false);
    const result = await service.rankFindings({ consent: false, findings });
    expect(result.value).toEqual(["screen", "risk", "opportunity"]);
    expect(result.externalAiUsed).toBe(false);
    expect(ChatOpenAI).not.toHaveBeenCalled();
  });

  it.each([
    ["screen", "risk"],
    ["screen", "risk", "opportunity", "invented"],
    ["screen", "screen", "opportunity"],
    ["screen", "risk", "invented"],
  ])("rejects omitted, extra, duplicate, or invented finding IDs: %j", (...ids) => {
    expect(() => validateCommitteeRanking(ids, findings.map((item) => item.id))).toThrow("invalid_structured_finding_ranking");
  });

  it("accepts a complete permutation", () => {
    expect(validateCommitteeRanking(["risk", "opportunity", "screen"], findings.map((item) => item.id))).toEqual(["risk", "opportunity", "screen"]);
  });

  it("falls back to challenge-first ordering after invalid model output", async () => {
    const invoke = jest.fn().mockResolvedValue({ parsed: { findingIds: ["opportunity"] }, raw: {} });
    jest.mocked(ChatOpenAI).mockImplementation(() => ({ withStructuredOutput: () => ({ invoke }) }) as unknown as ChatOpenAI);
    const service = new InvestmentCommitteeLlmService();
    jest.spyOn(service, "isAvailable").mockReturnValue(true);
    expect((await service.rankFindings({ consent: true, findings })).value).toEqual(["screen", "risk", "opportunity"]);
    const payload = JSON.parse(invoke.mock.calls[0][0][1].content);
    expect(payload).toEqual({ catalog: findings });
  });

  it("does not execute a failing tool twice inside provider fallback", async () => {
    jest.mocked(ChatOpenAI).mockImplementation(() => ({ bindTools: () => ({ invoke: async () => ({ tool_calls: [{ name: "plan", args: {} }] }) }) }) as unknown as ChatOpenAI);
    const service = new InvestmentCommitteeLlmService();
    jest.spyOn(service, "isAvailable").mockReturnValue(true);
    const invoke = jest.fn().mockRejectedValue(new Error("tool_failed_after_partial_write"));
    await expect(service.callTool({ consent: true, agentLabel: "strategy", tool: { name: "plan" } as StructuredToolInterface, invoke })).rejects.toThrow("tool_failed_after_partial_write");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
