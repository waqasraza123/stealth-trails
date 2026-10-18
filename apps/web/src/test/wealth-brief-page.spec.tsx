import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WealthBrief from "@/pages/WealthBrief";
import { renderWithRouter } from "@/test/render-with-router";
import { useUserStore } from "@/stores/userStore";
import { webLocaleStorageKey } from "@/i18n/provider";
import type { WealthBriefResult } from "@/hooks/ai/useWealthBrief";

vi.mock("axios");
const mockAxios = vi.mocked(axios, true);

function buildBrief(): WealthBriefResult {
  return {
    mode: "deterministic_preview",
    generatedAt: "2026-10-15T08:01:00.000Z",
    dataAsOf: "2026-10-15T08:00:00.000Z",
    summary: "This deterministic preview contains one balance record.",
    observations: [
      {
        text: "One asset balance record is available.",
        sourceIds: ["balances"],
      },
    ],
    riskFlags: [],
    researchQuestions: ["Which balances are available versus pending?"],
    financialPosition: {
      generatedAt: "2026-10-15T08:00:00.000Z",
      balances: [
        {
          assetSymbol: "ETH",
          assetName: "Ether",
          chainId: 8453,
          availableBalance: "2.5",
          pendingBalance: "0.1",
          updatedAt: "2026-10-15T08:00:00.000Z",
        },
      ],
      recentTransactions: [],
      stakingPositions: [],
      outstandingLoans: [],
      retirementVaults: [],
      solvency: null,
    },
    sources: [
      {
        id: "balances",
        label: "Account and asset balances",
        status: "available",
        asOf: "2026-10-15T08:00:00.000Z",
        recordCount: 1,
        note: null,
      },
    ],
    externalDataShared: false,
    provider: { configured: false, name: null, model: null },
    fallbackReason: null,
    disclaimer: "This brief is not investment advice.",
  };
}

describe("AI Wealth Brief page", () => {
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    useUserStore.setState({ token: null, user: null });
  });

  it("renders a clearly labeled deterministic preview with sources", async () => {
    const user = userEvent.setup();
    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          externalAiAvailable: false,
          providerName: null,
          model: null,
          disclosure: [],
        },
      },
    } as never);
    mockAxios.post.mockResolvedValue({
      data: { status: "success", message: "ok", data: buildBrief() },
    } as never);

    renderWithRouter(<WealthBrief />, { initialEntries: ["/wealth-brief"] });
    expect(
      await screen.findByText(/no external ai provider is configured/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /generate brief/i }));

    await waitFor(() =>
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/ai/wealth-brief"),
        { externalAiOptIn: false },
        expect.anything(),
      ),
    );
    expect(
      await screen.findByText("Deterministic preview"),
    ).toBeInTheDocument();
    expect(screen.getByText(/one balance record/i)).toBeInTheDocument();
    expect(screen.getByText("2.5 ETH")).toBeInTheDocument();
    expect(screen.getByText("Account and asset balances")).toBeInTheDocument();
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining("/ai/wealth-brief"),
      { externalAiOptIn: false },
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("requires an explicit checkbox action before requesting external generation", async () => {
    const user = userEvent.setup();
    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          externalAiAvailable: true,
          providerName: "openai_compatible",
          model: "configured-model",
          disclosure: ["Asset symbols and balance amounts"],
        },
      },
    } as never);
    mockAxios.post.mockResolvedValue({
      data: { status: "success", message: "ok", data: buildBrief() },
    } as never);

    renderWithRouter(<WealthBrief />, { initialEntries: ["/wealth-brief"] });
    const consent = await screen.findByRole("checkbox", {
      name: /allow external ai generation/i,
    });
    await user.click(consent);
    await user.click(screen.getByRole("button", { name: /generate brief/i }));

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/ai/wealth-brief"),
        { externalAiOptIn: true },
        expect.anything(),
      );
    });
  });

  it("renders partial, empty, and unknown-freshness source states", async () => {
    const user = userEvent.setup();
    const brief = buildBrief();
    brief.dataAsOf = null;
    brief.sources = [
      {
        id: "balances",
        label: "Account and asset balances",
        status: "partial",
        asOf: null,
        recordCount: 1,
        note: "Some records could not be included safely.",
      },
      {
        id: "transactions",
        label: "Recent transaction activity",
        status: "available_empty",
        asOf: null,
        recordCount: 0,
        note: null,
      },
    ];
    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          externalAiAvailable: false,
          providerName: null,
          model: null,
          disclosure: [],
        },
      },
    } as never);
    mockAxios.post.mockResolvedValue({
      data: { status: "success", message: "ok", data: brief },
    } as never);

    renderWithRouter(<WealthBrief />, { initialEntries: ["/wealth-brief"] });
    await screen.findByText(/no external ai provider is configured/i);
    await user.click(screen.getByRole("button", { name: /generate brief/i }));

    expect(await screen.findByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("Available empty")).toBeInTheDocument();
    expect(
      screen.getAllByText("Record freshness unknown", { exact: false }).length,
    ).toBeGreaterThan(1);
    expect(
      screen.getByText(/some records could not be included safely/i),
    ).toBeInTheDocument();
  });

  it("renders unknown freshness in Arabic", async () => {
    const user = userEvent.setup();
    const brief = buildBrief();
    brief.dataAsOf = null;
    brief.sources[0]!.asOf = null;
    localStorage.setItem(webLocaleStorageKey, "ar");
    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          externalAiAvailable: false,
          providerName: null,
          model: null,
          disclosure: [],
        },
      },
    } as never);
    mockAxios.post.mockResolvedValue({
      data: { status: "success", message: "ok", data: brief },
    } as never);

    renderWithRouter(<WealthBrief />, { initialEntries: ["/wealth-brief"] });
    await user.click(
      await screen.findByRole("button", { name: /إنشاء الموجز/i }),
    );

    expect(
      (
        await screen.findAllByText("حداثة البيانات غير معروفة", {
          exact: false,
        })
      ).length,
    ).toBeGreaterThan(1);
  });
});
