import { HttpException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";

jest.mock("../auth/customer-auth-crypto", () => ({
  customerAuthHmac: (value: string) =>
    `hmac:${Array.from(value).reduce((hash, character) => hash * 31 + character.charCodeAt(0), 7)}`,
}));

type BucketKey = string;

function createPrismaMock() {
  const counts = new Map<BucketKey, number>();
  const upsert = jest.fn(async (args: any) => {
    const key = JSON.stringify(args.where.action_subjectHash_windowStart);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return {
      id: key,
      attemptCount: count,
      windowStart: args.where.action_subjectHash_windowStart.windowStart,
    };
  });
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  return {
    counts,
    upsert,
    deleteMany,
    prisma: {
      authRateLimitBucket: { upsert, deleteMany },
    } as unknown as PrismaService,
  };
}

function createService(
  prisma: PrismaService,
  options: {
    environment: "development" | "test" | "production";
    externalAiEnabled: boolean;
  } = {
    environment: "test",
    externalAiEnabled: false,
  },
) {
  return new WealthBriefRateLimitService(prisma, options);
}

function expectHttpError(error: unknown, status: number, code: string) {
  expect(error).toBeInstanceOf(HttpException);
  const exception = error as HttpException;
  expect(exception.getStatus()).toBe(status);
  expect(exception.getResponse()).toEqual(expect.objectContaining({ code }));
  return exception.getResponse() as Record<string, unknown>;
}

describe("WealthBriefRateLimitService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-15T08:01:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("allows five distributed requests and rejects the sixth with retry information", async () => {
    const mock = createPrismaMock();
    const service = createService(mock.prisma);

    for (let request = 0; request < 5; request += 1) {
      await expect(
        service.assertAllowed("customer-a"),
      ).resolves.toBeUndefined();
    }

    const error = await service
      .assertAllowed("customer-a")
      .catch((caught) => caught);
    const response = expectHttpError(
      error,
      429,
      "AI_WEALTH_BRIEF_RATE_LIMITED",
    );
    expect(response.retryAfter).toBe(240);
  });

  it("cannot be bypassed by concurrent requests", async () => {
    const mock = createPrismaMock();
    const service = createService(mock.prisma);

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => service.assertAllowed("customer-a")),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(5);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(7);
  });

  it("isolates rate-limit counts by customer subject", async () => {
    const mock = createPrismaMock();
    const service = createService(mock.prisma);

    await Promise.all(
      ["customer-a", "customer-b"].flatMap((customer) =>
        Array.from({ length: 5 }, () => service.assertAllowed(customer)),
      ),
    );

    const firstError = await service
      .assertAllowed("customer-a")
      .catch((caught) => caught);
    const secondError = await service
      .assertAllowed("customer-b")
      .catch((caught) => caught);
    expectHttpError(firstError, 429, "AI_WEALTH_BRIEF_RATE_LIMITED");
    expectHttpError(secondError, 429, "AI_WEALTH_BRIEF_RATE_LIMITED");
    expect(mock.counts.size).toBe(2);
  });

  it("resets at a new fixed window and prunes only once per window", async () => {
    const mock = createPrismaMock();
    const service = createService(mock.prisma);

    for (let request = 0; request < 6; request += 1) {
      await service.assertAllowed("customer-a").catch(() => undefined);
    }
    expect(mock.deleteMany).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date("2026-10-15T08:05:00.000Z"));
    await expect(service.assertAllowed("customer-a")).resolves.toBeUndefined();
    expect(mock.deleteMany).toHaveBeenCalledTimes(2);
    expect(mock.deleteMany).toHaveBeenLastCalledWith({
      where: {
        action: "ai_wealth_brief",
        windowStart: { lt: new Date("2026-10-15T08:05:00.000Z") },
      },
    });
  });

  it("uses the bounded fallback in development and removes expired entries", async () => {
    const mock = createPrismaMock();
    mock.upsert.mockRejectedValue(new Error("database unavailable"));
    const service = createService(mock.prisma, {
      environment: "development",
      externalAiEnabled: true,
    });
    const fallback = (service as any).fallbackWindows as Map<
      string,
      { count: number; resetAt: number }
    >;
    fallback.set("expired", { count: 1, resetAt: Date.now() - 1 });

    for (let request = 0; request < 5; request += 1) {
      await expect(
        service.assertAllowed("customer-a"),
      ).resolves.toBeUndefined();
    }
    expect(fallback.has("expired")).toBe(false);

    const error = await service
      .assertAllowed("customer-a")
      .catch((caught) => caught);
    expectHttpError(error, 429, "AI_WEALTH_BRIEF_RATE_LIMITED");
  });

  it("fails closed when the distributed store fails in production with external AI", async () => {
    const mock = createPrismaMock();
    mock.upsert.mockRejectedValue(new Error("database unavailable"));
    const service = createService(mock.prisma, {
      environment: "production",
      externalAiEnabled: true,
    });

    const error = await service
      .assertAllowed("customer-a")
      .catch((caught) => caught);
    expectHttpError(error, 503, "AI_WEALTH_BRIEF_RATE_LIMITER_UNAVAILABLE");
  });

  it("fails closed when the distributed store fails in production without external AI", async () => {
    const mock = createPrismaMock();
    mock.upsert.mockRejectedValue(new Error("database unavailable"));
    const service = createService(mock.prisma, {
      environment: "production",
      externalAiEnabled: false,
    });

    const error = await service
      .assertAllowed("customer-a")
      .catch((caught) => caught);
    expectHttpError(error, 503, "AI_WEALTH_BRIEF_RATE_LIMITER_UNAVAILABLE");
  });

  it("bounds the in-memory fallback without evicting active customer windows", async () => {
    const mock = createPrismaMock();
    mock.upsert.mockRejectedValue(new Error("database unavailable"));
    const service = createService(mock.prisma);
    const fallback = (service as any).fallbackWindows as Map<
      string,
      { count: number; resetAt: number }
    >;
    for (let index = 0; index < 10_000; index += 1) {
      fallback.set(`existing-${index}`, {
        count: 1,
        resetAt: Date.now() + 60_000,
      });
    }

    const error = await service
      .assertAllowed("new-customer")
      .catch((caught) => caught);

    expectHttpError(error, 429, "AI_WEALTH_BRIEF_RATE_LIMITED");
    expect(fallback.size).toBe(10_000);
  });

  it("does not expose raw customer identifiers in persistence or logs", async () => {
    const mock = createPrismaMock();
    mock.upsert.mockRejectedValue(new Error("database unavailable"));
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const service = createService(mock.prisma);
    const rawIdentity = "customer-secret-identifier";

    await service.assertAllowed(rawIdentity);

    expect(JSON.stringify(mock.upsert.mock.calls)).not.toContain(rawIdentity);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawIdentity);
  });

  it("does not reject an allowed request when expired-bucket cleanup fails", async () => {
    const mock = createPrismaMock();
    mock.deleteMany.mockRejectedValue(new Error("cleanup unavailable"));
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const service = createService(mock.prisma);

    await expect(service.assertAllowed("customer-a")).resolves.toBeUndefined();
  });
});
