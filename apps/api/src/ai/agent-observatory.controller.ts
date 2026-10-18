import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AgentObservatoryService } from "./agent-observatory.service";
import type { AgentObservatoryDashboard } from "./agent-observatory.types";
import { GetAgentObservatoryDto } from "./dto/get-agent-observatory.dto";

type AuthenticatedRequest = { user: { id: string } };

@Controller("ai/observatory")
export class AgentObservatoryController {
  constructor(private readonly observatory: AgentObservatoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async customerDashboard(
    @Request() request: AuthenticatedRequest,
    @Query() query: GetAgentObservatoryDto,
  ): Promise<CustomJsonResponse<AgentObservatoryDashboard>> {
    return {
      status: "success",
      message: "Customer AI agent activity retrieved successfully.",
      data: await this.observatory.getCustomerDashboard(request.user.id, query),
    };
  }

  @Get("internal")
  @UseGuards(InternalOperatorBearerGuard)
  async operatorDashboard(
    @Query() query: GetAgentObservatoryDto,
  ): Promise<CustomJsonResponse<AgentObservatoryDashboard>> {
    return {
      status: "success",
      message: "Authorized AI agent diagnostics retrieved successfully.",
      data: await this.observatory.getOperatorDashboard(query),
    };
  }
}
