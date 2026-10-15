import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { AiController } from "./ai.controller";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { WealthBriefService } from "./wealth-brief.service";

describe("AiController", () => {
  let app: INestApplication;
  const authService = {
    validateToken: jest.fn(),
  };
  const wealthBriefService = {
    getCapabilities: jest.fn(),
    generate: jest.fn(),
  };
  const rateLimitService = {
    assertAllowed: jest.fn(),
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [AiController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: WealthBriefService, useValue: wealthBriefService },
        { provide: WealthBriefRateLimitService, useValue: rateLimitService },
        JwtAuthGuard,
      ],
    });
    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.validateToken.mockResolvedValue({
      id: "customer-session-subject-a",
      sessionId: "session-a",
    });
    wealthBriefService.generate.mockResolvedValue({
      mode: "deterministic_preview",
    });
  });

  it("requires an authenticated customer session", async () => {
    await request(app.getHttpServer())
      .post("/ai/wealth-brief")
      .send({ externalAiOptIn: false })
      .expect(401);

    expect(wealthBriefService.generate).not.toHaveBeenCalled();
  });

  it("uses only the authenticated identity and rejects client-supplied identity fields", async () => {
    await request(app.getHttpServer())
      .post("/ai/wealth-brief")
      .set("Authorization", "Bearer session-token")
      .send({
        externalAiOptIn: true,
        customerId: "another-customer",
      })
      .expect(400);

    expect(wealthBriefService.generate).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post("/ai/wealth-brief")
      .set("Authorization", "Bearer session-token")
      .send({ externalAiOptIn: true })
      .expect(201);

    expect(rateLimitService.assertAllowed).toHaveBeenCalledWith(
      "customer-session-subject-a",
    );
    expect(wealthBriefService.generate).toHaveBeenCalledWith(
      "customer-session-subject-a",
      true,
    );
  });
});
