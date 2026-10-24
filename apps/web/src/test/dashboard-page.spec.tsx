import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyRetirementVaults } from "@/hooks/retirement-vault/useMyRetirementVaults";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import { webLocaleStorageKey } from "@/i18n/provider";
import Index from "@/pages/Index";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseMyRetirementVaults = vi.mocked(useMyRetirementVaults);
const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn()
}));

vi.mock("@/hooks/retirement-vault/useMyRetirementVaults", () => ({
  useMyRetirementVaults: vi.fn()
}));

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn()
}));

describe("dashboard page", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [
          {
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "1.500000",
            pendingBalance: "0.250000",
            updatedAt: "2026-04-05T09:00:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: [
          {
            id: "intent_1",
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            sourceWalletAddress: null,
            destinationWalletAddress: "0x1111222233334444555566667777888899990000",
            externalAddress: null,
            intentType: "deposit",
            status: "requested",
            policyDecision: "pending",
            requestedAmount: "1.25",
            settledAmount: null,
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-05T10:30:00.000Z",
            updatedAt: "2026-04-05T10:30:00.000Z",
            latestBlockchainTransaction: null
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyTransactionHistory>);

    mockUseMyRetirementVaults.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        vaults: [
          {
            id: "vault_1",
            customerAccountId: "account_1",
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            status: "active",
            strictMode: true,
            unlockAt: "2036-04-05T00:00:00.000Z",
            lockedBalance: "0.75",
            fundedAt: "2026-04-05T09:30:00.000Z",
            lastFundedAt: "2026-04-05T09:30:00.000Z",
            createdAt: "2026-04-05T09:00:00.000Z",
            updatedAt: "2026-04-05T09:30:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyRetirementVaults>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders live balances, wallet details, and recent transaction history", () => {
    renderWithRouter(<Index />);

    expect(screen.getAllByRole("heading", { name: "Dashboard" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/managed account overview for amina/i)).toBeInTheDocument();
    expect(screen.getAllByText("Ethereum").length).toBeGreaterThan(0);
    expect(screen.getByText("1.5 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.25 ETH")).toBeInTheDocument();
    expect(screen.getAllByText("0x1111222233334444555566667777888899990000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deposit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+1.25 ETH").length).toBeGreaterThan(0);
    expect(screen.getByText(/trust layer/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Retirement Vault/i })).toBeInTheDocument();
  });

  it("renders safe empty states when no balances or transaction history exist", () => {
    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyTransactionHistory>);

    mockUseMyRetirementVaults.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        vaults: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyRetirementVaults>);

    renderWithRouter(<Index />);

    expect(screen.getByText("No balances yet")).toBeInTheDocument();
    expect(screen.getAllByText(/No transaction history has been recorded/i).length).toBeGreaterThan(0);
  });

  it("renders balance and history load failures without collapsing the dashboard shell", () => {
    mockUseMyBalances.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Balance feed unavailable")
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("History feed unavailable")
    } as ReturnType<typeof useMyTransactionHistory>);

    mockUseMyRetirementVaults.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Vault feed unavailable")
    } as ReturnType<typeof useMyRetirementVaults>);

    renderWithRouter(<Index />);

    expect(screen.getByText("Balance feed unavailable")).toBeInTheDocument();
    expect(screen.getByText("History feed unavailable")).toBeInTheDocument();
    expect(screen.getByText("Vault feed unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Trust & safety/i)).toBeInTheDocument();
  });

  it("falls back to the generic overview copy when the customer first name is missing", () => {
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });

    renderWithRouter(<Index />);

    expect(screen.getByText("Managed account overview.")).toBeInTheDocument();
  });

  it("renders Arabic copy, no-wallet fallback, and available-state balances", () => {
    localStorage.setItem(webLocaleStorageKey, "ar");
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "أمينة",
        lastName: "رحمن",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: null as unknown as string
      }
    });

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [
          {
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "3",
            pendingBalance: "0",
            updatedAt: "2026-04-05T09:00:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyTransactionHistory>);

    mockUseMyRetirementVaults.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        vaults: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyRetirementVaults>);

    renderWithRouter(<Index />);

    expect(screen.getAllByRole("heading", { name: "لوحة التحكم" }).length).toBeGreaterThan(0);
    expect(screen.getByText("نظرة عامة على الحساب المُدار لـ أمينة.")).toBeInTheDocument();
    expect(screen.getAllByText("متاح").length).toBeGreaterThan(0);
    expect(screen.getAllByText("لم يتم تعيين محفظة مُدارة بعد.").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("لم يتم تسجيل أي سجل معاملات لهذا الحساب حتى الآن.").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("الثقة والسلامة")).toBeInTheDocument();
  });
});
