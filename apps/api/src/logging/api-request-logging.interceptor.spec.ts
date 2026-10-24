import { BadRequestException } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { ApiRequestLoggingInterceptor } from "./api-request-logging.interceptor";
import { ApiRequestMetricsService } from "./api-request-metrics.service";
import type { ApiRequestContext } from "./api-request-context";

function createHttpExecutionContext(
  request: ApiRequestContext,
  response: {
    statusCode: number;
    getHeader?: (name: string) => unknown;
  }
) {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as any;
}

describe("ApiRequestLoggingInterceptor", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("discards recovery URL queries without logging request bodies", async () => {
    const interceptor = new ApiRequestLoggingInterceptor(new ApiRequestMetricsService());
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const request = {
      method: "POST", originalUrl: "/auth/reset-password?token=secret-token",
      url: "/auth/reset-password?token=secret-token", headers: {},
      route: { path: "/auth/reset-password" },
      body: { token: "secret-token", newPassword: "secret-password" },
    } as ApiRequestContext;
    await lastValueFrom(interceptor.intercept(createHttpExecutionContext(request, { statusCode: 200 }), {
      handle: () => of({ status: "success" }),
    }));
    const log = consoleSpy.mock.calls[0][0];
    expect(log).not.toContain("secret-token");
    expect(log).not.toContain("secret-password");
    expect(JSON.parse(log).path).toBe("/auth/reset-password");
  });

  it("writes structured success logs with request context", async () => {
    const interceptor = new ApiRequestLoggingInterceptor(
      new ApiRequestMetricsService()
    );
    const request = {
      requestId: "request-id_1234",
      method: "GET",
      originalUrl: "/review-cases/internal",
      url: "/review-cases/internal",
      route: {
        path: "/review-cases/internal"
      },
      ip: "127.0.0.1",
      headers: {
        "user-agent": "vitest",
        origin: "http://localhost:5173"
      },
      internalOperator: {
        operatorId: "ops_1",
        operatorRole: "operations_admin"
      }
    } as ApiRequestContext;
    const response = {
      statusCode: 200,
      getHeader: () => "request-id_1234"
    };
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await lastValueFrom(
      interceptor.intercept(createHttpExecutionContext(request, response), {
        handle: () => of({ ok: true })
      })
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpy.mock.calls[0]?.[0] as string)).toEqual(
      expect.objectContaining({
        level: "info",
        service: "api",
        event: "http_request_completed",
        requestId: "request-id_1234",
        actorType: "operator",
        actorId: "ops_1",
        statusCode: 200
      })
    );
  });

  it("writes structured failure logs with status code and error details", async () => {
    const interceptor = new ApiRequestLoggingInterceptor(
      new ApiRequestMetricsService()
    );
    const request = {
      requestId: "request-id_1234",
      method: "POST",
      originalUrl: "/transaction-intents/deposit-requests",
      url: "/transaction-intents/deposit-requests",
      headers: {},
      user: {
        id: "customer_1",
        email: "customer@example.com"
      }
    } as ApiRequestContext;
    const response = {
      statusCode: 200,
      getHeader: () => "request-id_1234"
    };
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      lastValueFrom(
        interceptor.intercept(createHttpExecutionContext(request, response), {
          handle: () => throwError(() => new BadRequestException("Invalid request"))
        })
      )
    ).rejects.toThrow(BadRequestException);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpy.mock.calls[0]?.[0] as string)).toEqual(
      expect.objectContaining({
        level: "warn",
        service: "api",
        event: "http_request_failed",
        requestId: "request-id_1234",
        actorType: "customer",
        actorId: "customer_1",
        statusCode: 400
      })
    );
  });

  it("suppresses successful worker polling logs", async () => {
    const interceptor = new ApiRequestLoggingInterceptor(
      new ApiRequestMetricsService()
    );
    const request = {
      requestId: "request-id_worker",
      method: "GET",
      originalUrl: "/transaction-intents/internal/worker/deposit-requests/queued?limit=20",
      url: "/transaction-intents/internal/worker/deposit-requests/queued?limit=20",
      route: {
        path: "/transaction-intents/internal/worker/deposit-requests/queued"
      },
      ip: "127.0.0.1",
      headers: {
        "user-agent": "axios/1.14.0"
      },
      internalWorker: {
        workerId: "worker-local-1"
      }
    } as ApiRequestContext;
    const response = {
      statusCode: 200,
      getHeader: () => "request-id_worker"
    };
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await lastValueFrom(
      interceptor.intercept(createHttpExecutionContext(request, response), {
        handle: () => of({ intents: [] })
      })
    );

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
