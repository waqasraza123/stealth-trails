import axios from "axios";
import type { AiWealthBriefRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  buildWealthBriefStatementCatalog,
  renderSelectedInterpretation,
} from "./wealth-brief-catalog";
import {
  DisabledWealthBriefProvider,
  InvalidWealthBriefProviderOutputError,
  OpenAiCompatibleWealthBriefProvider,
  validateWealthBriefSelection,
} from "./wealth-brief.provider";
import type { WealthSnapshot } from "./wealth-brief.types";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildSnapshot(): WealthSnapshot {
  const generatedAt = "2026-10-15T08:00:00.000Z";
  return {
    generatedAt,
    balances: [
      {
        assetSymbol: "ETH",
        assetName: "Ether",
        chainId: 8453,
        availableBalance: "2",
        pendingBalance: "1.5",
        updatedAt: generatedAt,
      },
    ],
    recentTransactions: [],
    stakingPositions: [],
    outstandingLoans: [],
    retirementVaults: [],
    solvency: null,
    sources: [
      {
        id: "balances",
        label: "Account and asset balances",
        status: "available",
        asOf: generatedAt,
        recordCount: 1,
        note: null,
      },
      ...(["transactions", "staking", "loans", "retirement_vaults", "solvency"] as const).map(
        (id) => ({
          id,
          label: id,
          status: "unavailable" as const,
          asOf: generatedAt,
          recordCount: 0,
          note: "This source was unavailable when the brief was generated.",
        }),
      ),
    ],
  };
}

function buildConfig(): AiWealthBriefRuntimeConfig {
  return {
    provider: "openai_compatible",
    endpoint: "https://provider.example.com/v1/chat/completions",
    apiKey: "test-api-key",
    model: "test-model",
    requestTimeoutMs: 5_000,
    maxOutputTokens: 700,
    allowedProviderHosts: ["provider.example.com"],
    localProviderExceptionEnabled: false,
  };
}

function mockProviderContent(payload: unknown): void {
  mockedAxios.post.mockResolvedValue({
    data: {
      choices: [{ message: { content: JSON.stringify(payload) } }],
    },
  });
}

const catalog = buildWealthBriefStatementCatalog(buildSnapshot());

describe("validateWealthBriefSelection", () => {
  it("accepts a valid selection and removes duplicate ids", () => {
    const selection = validateWealthBriefSelection(
      {
        observationIds: ["obs.balances.count", "obs.balances.count"],
        riskFlagIds: ["risk.balances.pending"],
        researchQuestionIds: ["research.balances.availability"],
      },
      catalog,
    );

    expect(selection.observationIds).toEqual(["obs.balances.count"]);
    expect(selection.riskFlagIds).toEqual(["risk.balances.pending"]);
    expect(selection.researchQuestionIds).toEqual([
      "research.balances.availability",
    ]);
  });

  it("rejects nonexistent statement identifiers", () => {
    expect(() =>
      validateWealthBriefSelection(
        {
          observationIds: ["obs.balances.fabricated"],
          riskFlagIds: [],
          researchQuestionIds: [],
        },
        catalog,
      ),
    ).toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("rejects fabricated critical risk warnings", () => {
    expect(() =>
      validateWealthBriefSelection(
        {
          observationIds: [],
          riskFlagIds: ["risk.solvency.critical_insolvency"],
          researchQuestionIds: [],
        },
        catalog,
      ),
    ).toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("rejects ids placed under the wrong statement kind", () => {
    expect(() =>
      validateWealthBriefSelection(
        {
          observationIds: ["risk.balances.pending"],
          riskFlagIds: [],
          researchQuestionIds: [],
        },
        catalog,
      ),
    ).toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("rejects identifiers that are unavailable in the current snapshot catalog", () => {
    // risk.loans.distressed is a known id shape but is not eligible for this
    // snapshot because the customer has no distressed loans.
    expect(() =>
      validateWealthBriefSelection(
        {
          observationIds: [],
          riskFlagIds: ["risk.loans.distressed"],
          researchQuestionIds: [],
        },
        catalog,
      ),
    ).toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("rejects a completely empty selection", () => {
    expect(() =>
      validateWealthBriefSelection(
        { observationIds: [], riskFlagIds: [], researchQuestionIds: [] },
        catalog,
      ),
    ).toThrow(InvalidWealthBriefProviderOutputError);
  });

  it.each([
    null,
    "text",
    ["obs.balances.count"],
    { observationIds: "obs.balances.count" },
    { observationIds: [42] },
    { observationIds: new Array(7).fill("obs.balances.count") },
  ])("rejects malformed provider output: %p", (payload) => {
    expect(() => validateWealthBriefSelection(payload, catalog)).toThrow(
      InvalidWealthBriefProviderOutputError,
    );
  });
});

describe("renderSelectedInterpretation", () => {
  it("renders statements from server catalog data and preserves model ranking", () => {
    const snapshot = buildSnapshot();
    const rendered = renderSelectedInterpretation(snapshot, catalog, {
      observationIds: ["obs.balances.count"],
      riskFlagIds: ["risk.balances.pending", "risk.source_unavailable.loans"],
      researchQuestionIds: ["research.solvency.freshness"],
    });

    expect(rendered.observations).toEqual([
      {
        text: "1 asset balance record is available in this snapshot.",
        sourceIds: ["balances"],
      },
    ]);
    expect(rendered.riskFlags.map((flag) => flag.title)).toEqual([
      "Pending balances present",
      "Outstanding loans unavailable",
    ]);
    expect(rendered.riskFlags[0]?.severity).toBe("info");
    expect(rendered.riskFlags.every((flag) => flag.sourceIds.length > 0)).toBe(true);
    expect(rendered.researchQuestions).toEqual([
      "How current is the latest solvency evidence for each represented asset?",
    ]);
    expect(rendered.summary).toContain("server-verified statement catalog");
  });
});

describe("OpenAiCompatibleWealthBriefProvider", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it("disables redirects and keeps the API key server-side in the request", async () => {
    mockProviderContent({
      observationIds: ["obs.balances.count"],
      riskFlagIds: [],
      researchQuestionIds: [],
    });
    const provider = new OpenAiCompatibleWealthBriefProvider(buildConfig());
    const snapshot = buildSnapshot();

    await provider.generate(snapshot, catalog);

    const [url, body, options] = mockedAxios.post.mock.calls[0]!;
    expect(url).toBe("https://provider.example.com/v1/chat/completions");
    expect(options).toMatchObject({
      timeout: 5_000,
      maxRedirects: 0,
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
    });

    // The model receives the catalog, never the raw financial snapshot.
    const messages = (body as { messages: Array<{ role: string; content: string }> })
      .messages;
    const userPayload = messages.find((message) => message.role === "user")?.content ?? "";
    expect(userPayload).toContain("obs.balances.count");
    expect(userPayload).not.toContain("\"availableBalance\"");
    expect(userPayload).not.toContain("\"pendingBalance\":\"1.5\"");
    expect(userPayload).not.toContain(snapshot.balances[0]!.availableBalance);
  });

  it("rejects fabricated identifiers returned by the provider", async () => {
    mockProviderContent({
      observationIds: ["obs.balances.count"],
      riskFlagIds: ["risk.balances.pending", "risk.fake.critical"],
      researchQuestionIds: [],
    });
    const provider = new OpenAiCompatibleWealthBriefProvider(buildConfig());

    await expect(
      provider.generate(buildSnapshot(), catalog),
    ).rejects.toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("rejects non-JSON provider content", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: "not json" } }] },
    });
    const provider = new OpenAiCompatibleWealthBriefProvider(buildConfig());

    await expect(
      provider.generate(buildSnapshot(), catalog),
    ).rejects.toThrow(InvalidWealthBriefProviderOutputError);
  });

  it("propagates redirect and transport failures instead of following them", async () => {
    // With maxRedirects: 0 a 3xx response makes axios reject; the error must
    // surface so the service falls back instead of reaching a redirected host.
    mockedAxios.post.mockRejectedValue(
      new Error("Request failed with status code 302"),
    );
    const provider = new OpenAiCompatibleWealthBriefProvider(buildConfig());

    await expect(
      provider.generate(buildSnapshot(), catalog),
    ).rejects.toThrow("Request failed with status code 302");
  });

  it("fails closed when provider configuration is incomplete", async () => {
    const provider = new OpenAiCompatibleWealthBriefProvider({
      ...buildConfig(),
      apiKey: null,
    });

    await expect(
      provider.generate(buildSnapshot(), catalog),
    ).rejects.toThrow("AI wealth brief provider configuration is incomplete.");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});

describe("DisabledWealthBriefProvider", () => {
  it("reports no external capability and refuses generation", async () => {
    const provider = new DisabledWealthBriefProvider();
    expect(provider.getCapabilities().externalAiAvailable).toBe(false);
    await expect(provider.generate()).rejects.toThrow(
      "External AI wealth brief generation is not configured.",
    );
  });
});
