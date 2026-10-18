import { HttpException, Injectable, Logger } from "@nestjs/common";
import type { ApiRuntimeEnvironment } from "@stealth-trails-bank/config/api";
import { customerAuthHmac } from "../auth/customer-auth-crypto";
import { PrismaService } from "../prisma/prisma.service";

export type WealthBriefRateLimitOptions = {
  environment: ApiRuntimeEnvironment;
  externalAiEnabled: boolean;
};

type FallbackWindow = {
  count: number;
  resetAt: number;
};

// Reuses the existing distributed AuthRateLimitBucket store under its own
// action namespace, so limits are shared across every API instance. Only keyed
// subject hashes are ever stored or logged; raw customer identifiers are not.
const RATE_LIMIT_ACTION = "ai_wealth_brief";
const WINDOW_SECONDS = 5 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const REQUEST_LIMIT = 5;
// Bound for the development-only in-memory fallback so an outage of the
// distributed store can never grow memory without limit.
const MAX_FALLBACK_SUBJECTS = 10_000;

function currentWindowStart(now: number): Date {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

@Injectable()
export class WealthBriefRateLimitService {
  private readonly logger = new Logger(WealthBriefRateLimitService.name);
  private readonly fallbackWindows = new Map<string, FallbackWindow>();
  private fallbackWarningLogged = false;
  private lastPrunedWindowStartMs: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly options: WealthBriefRateLimitOptions,
  ) {}

  async assertAllowed(customerIdentity: string): Promise<void> {
    const subjectHash = customerAuthHmac(customerIdentity);

    let retryAfterSeconds: number | null;
    try {
      retryAfterSeconds = await this.consumeDistributed(subjectHash);
      this.fallbackWarningLogged = false;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // The distributed store failed. Production has no safe per-instance
      // substitute, regardless of provider mode, so fail closed. Development
      // and test may use the bounded in-memory limiter.
      if (this.options.environment === "production") {
        throw new HttpException(
          {
            status: "failed",
            message:
              "Wealth brief rate limiting is temporarily unavailable. Try again later.",
            code: "AI_WEALTH_BRIEF_RATE_LIMITER_UNAVAILABLE",
          },
          503,
        );
      }
      if (!this.fallbackWarningLogged) {
        this.logger.warn(
          "Distributed wealth brief rate limit store unavailable; using the bounded in-memory fallback.",
        );
        this.fallbackWarningLogged = true;
      }
      this.consumeFallback(subjectHash);
      return;
    }

    if (retryAfterSeconds !== null) {
      throw this.tooManyRequests(retryAfterSeconds);
    }
  }

  // Fixed-window counting via an atomic upsert + increment. Concurrent
  // requests cannot lose increments, so the limit holds across instances.
  private async consumeDistributed(
    subjectHash: string,
  ): Promise<number | null> {
    const now = Date.now();
    const windowStart = currentWindowStart(now);
    const bucket = await this.prisma.authRateLimitBucket.upsert({
      where: {
        action_subjectHash_windowStart: {
          action: RATE_LIMIT_ACTION,
          subjectHash,
          windowStart,
        },
      },
      create: {
        action: RATE_LIMIT_ACTION,
        subjectHash,
        windowStart,
        attemptCount: 1,
      },
      update: {
        attemptCount: { increment: 1 },
      },
    });

    // Run at most once per fixed window per API process. Mark it before the
    // await so concurrent first requests do not all issue the same delete.
    if (this.lastPrunedWindowStartMs !== windowStart.getTime()) {
      this.lastPrunedWindowStartMs = windowStart.getTime();
      // Cleanup is best-effort and must not add a table-wide delete to request
      // latency. The cleanup method catches and logs its own failures.
      void this.pruneExpiredBuckets(windowStart);
    }

    if (bucket.attemptCount > REQUEST_LIMIT) {
      return Math.max(
        1,
        Math.ceil((windowStart.getTime() + WINDOW_MS - now) / 1000),
      );
    }
    return null;
  }

  private async pruneExpiredBuckets(currentWindow: Date): Promise<void> {
    try {
      await this.prisma.authRateLimitBucket.deleteMany({
        where: {
          action: RATE_LIMIT_ACTION,
          windowStart: { lt: currentWindow },
        },
      });
    } catch {
      this.logger.warn(
        "Failed to prune expired wealth brief rate limit buckets.",
      );
    }
  }

  // Synchronous check-and-increment, so concurrent in-process requests cannot
  // interleave. Bounded by MAX_FALLBACK_SUBJECTS with expired-window eviction.
  private consumeFallback(subjectHash: string): void {
    const now = Date.now();
    let current = this.fallbackWindows.get(subjectHash);

    if (!current || current.resetAt <= now) {
      this.evictExpiredFallbackWindows(now);
      if (!current && this.fallbackWindows.size >= MAX_FALLBACK_SUBJECTS) {
        throw this.tooManyRequests(WINDOW_SECONDS);
      }
      current = { count: 0, resetAt: now + WINDOW_MS };
      this.fallbackWindows.set(subjectHash, current);
    }

    current.count += 1;
    if (current.count > REQUEST_LIMIT) {
      throw this.tooManyRequests(
        Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      );
    }
  }

  private evictExpiredFallbackWindows(now: number): void {
    for (const [key, window] of this.fallbackWindows) {
      if (window.resetAt <= now) {
        this.fallbackWindows.delete(key);
      }
    }
  }

  private tooManyRequests(retryAfterSeconds: number): HttpException {
    return new HttpException(
      {
        status: "failed",
        message: "Too many wealth brief requests. Try again later.",
        code: "AI_WEALTH_BRIEF_RATE_LIMITED",
        retryAfter: retryAfterSeconds,
      },
      429,
    );
  }
}
