import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { OpportunityHunterController } from "./opportunity-hunter.controller";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import { AgentObservatoryService } from "./agent-observatory.service";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { FinancialMemoryService } from "./financial-memory.service";

describe("OpportunityHunterController", () => {
  let app: INestApplication;
  const authService = { validateToken: jest.fn() };
  const opportunityHunter = {
    discover: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [OpportunityHunterController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: OpportunityHunterService, useValue: opportunityHunter },
        {
          provide: WealthBriefRateLimitService,
          useValue: { assertAllowed: jest.fn() },
        },
        {
          provide: AgentObservatoryService,
          useValue: {
            observeCustomer: (
              _subject: string,
              operation: { execute: () => Promise<unknown> },
            ) => operation.execute(),
          },
        },
        {
          provide: FinancialMemoryService,
          useValue: {
            retrieveForAgent: jest.fn().mockResolvedValue({ influences: [] }),
          },
        },
        JwtAuthGuard,
      ],
    });
    app = result.app;
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    authService.validateToken.mockResolvedValue({
      id: "customer-session-subject-a",
      sessionId: "session-a",
    });
    opportunityHunter.discover.mockReturnValue({
      dataset: { kind: "synthetic_research" },
      opportunities: [],
    });
    opportunityHunter.findOne.mockReturnValue({
      id: "syn-onchain-payments-index",
      synthetic: true,
    });
  });

  it("requires authentication for opportunity discovery", async () => {
    await request(app.getHttpServer()).get("/ai/opportunities").expect(401);
    expect(opportunityHunter.discover).not.toHaveBeenCalled();
  });

  it("returns the synthetic catalog to an authenticated customer", async () => {
    const response = await request(app.getHttpServer())
      .get("/ai/opportunities")
      .set("Authorization", "Bearer session-token")
      .expect(200);

    expect(response.body.data.dataset.kind).toBe("synthetic_research");
    expect(opportunityHunter.discover).toHaveBeenCalledTimes(1);
  });

  it("returns a detail record through the read-only detail endpoint", async () => {
    const response = await request(app.getHttpServer())
      .get("/ai/opportunities/syn-onchain-payments-index")
      .set("Authorization", "Bearer session-token")
      .expect(200);

    expect(response.body.data.synthetic).toBe(true);
    expect(opportunityHunter.findOne).toHaveBeenCalledWith(
      "syn-onchain-payments-index",
    );
  });
});
