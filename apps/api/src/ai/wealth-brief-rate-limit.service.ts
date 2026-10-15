import { HttpException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

type RateWindow = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 5 * 60 * 1000;
const REQUEST_LIMIT = 5;

@Injectable()
export class WealthBriefRateLimitService {
  private readonly windows = new Map<string, RateWindow>();

  assertAllowed(customerIdentity: string): void {
    const now = Date.now();
    const subjectHash = createHash("sha256").update(customerIdentity).digest("hex");
    const current = this.windows.get(subjectHash);

    if (!current || current.resetAt <= now) {
      this.windows.set(subjectHash, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return;
    }

    if (current.count >= REQUEST_LIMIT) {
      throw new HttpException(
        {
          status: "failed",
          message: "Too many wealth brief requests. Try again later.",
          code: "AI_WEALTH_BRIEF_RATE_LIMITED",
          retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        },
        429,
      );
    }

    current.count += 1;
  }
}
