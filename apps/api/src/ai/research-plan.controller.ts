import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CompareResearchPlansDto } from "./dto/compare-research-plans.dto";
import { SaveResearchPlanDto } from "./dto/save-research-plan.dto";
import { ResearchPlanService } from "./research-plan.service";
import type {
  InvestmentResearchPlan,
  ResearchPlanComparison,
  ResearchPlanStudioDashboard,
} from "./research-plan.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import {
  summarizePlanComparison,
  summarizeResearchPlanRun,
} from "./agent-observatory.summaries";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/research-plans")
export class ResearchPlanController {
  constructor(
    private readonly plans: ResearchPlanService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Get()
  async dashboard(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<ResearchPlanStudioDashboard>> {
    return {
      status: "success",
      message: "Investment Research Plan Studio retrieved successfully.",
      data: await this.plans.getDashboard(request.user.id),
    };
  }

  @Get(":planId")
  async getPlan(
    @Request() request: AuthenticatedRequest,
    @Param("planId") planId: string,
  ): Promise<CustomJsonResponse<InvestmentResearchPlan>> {
    return {
      status: "success",
      message: "Research plan retrieved successfully.",
      data: await this.plans.getPlan(request.user.id, planId),
    };
  }

  @Post()
  async createPlan(
    @Request() request: AuthenticatedRequest,
    @Body() dto: SaveResearchPlanDto,
  ): Promise<CustomJsonResponse<InvestmentResearchPlan>> {
    return {
      status: "success",
      message: "Educational research plan created successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "research-plan-studio",
        workflow: "create_research_plan",
        execute: () => this.plans.createPlan(request.user.id, dto),
        summarize: summarizeResearchPlanRun,
      }),
    };
  }

  @Patch(":planId")
  async revisePlan(
    @Request() request: AuthenticatedRequest,
    @Param("planId") planId: string,
    @Body() dto: SaveResearchPlanDto,
  ): Promise<CustomJsonResponse<InvestmentResearchPlan>> {
    return {
      status: "success",
      message: "Research plan revision saved successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "research-plan-studio",
        workflow: "revise_research_plan",
        execute: () => this.plans.revisePlan(request.user.id, planId, dto),
        summarize: summarizeResearchPlanRun,
      }),
    };
  }

  @Post("compare")
  async compare(
    @Request() request: AuthenticatedRequest,
    @Body() dto: CompareResearchPlansDto,
  ): Promise<CustomJsonResponse<ResearchPlanComparison>> {
    return {
      status: "success",
      message: "Research plans compared successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "research-plan-studio",
        workflow: "compare_research_plans",
        execute: () => this.plans.comparePlans(request.user.id, dto.planIds),
        summarize: summarizePlanComparison,
      }),
    };
  }

  @Get(":planId/export")
  async exportPlan(
    @Request() request: AuthenticatedRequest,
    @Param("planId") planId: string,
  ): Promise<CustomJsonResponse<InvestmentResearchPlan>> {
    return {
      status: "success",
      message: "Research plan export prepared successfully.",
      data: await this.plans.getPlan(request.user.id, planId),
    };
  }
}
