import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ControlInvestmentCommitteeMissionDto, StartInvestmentCommitteeMissionDto } from "./dto/investment-committee.dto";
import { InvestmentCommitteeService } from "./investment-committee.service";
import type { InvestmentCommitteeDashboard, InvestmentCommitteeMission } from "./investment-committee.types";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/investment-committee")
export class InvestmentCommitteeController {
  constructor(private readonly committee: InvestmentCommitteeService) {}

  @Get()
  async dashboard(@Request() request: AuthenticatedRequest): Promise<CustomJsonResponse<InvestmentCommitteeDashboard>> {
    return { status: "success", message: "Investment committee missions retrieved successfully.", data: await this.committee.getDashboard(request.user.id) };
  }

  @Post("missions")
  async start(@Request() request: AuthenticatedRequest, @Body() dto: StartInvestmentCommitteeMissionDto): Promise<CustomJsonResponse<InvestmentCommitteeMission>> {
    return { status: "success", message: "Investment committee mission queued successfully.", data: await this.committee.startMission(request.user.id, dto) };
  }

  @Get("missions/:id")
  async mission(@Request() request: AuthenticatedRequest, @Param("id") id: string): Promise<CustomJsonResponse<InvestmentCommitteeMission>> {
    return { status: "success", message: "Investment committee mission retrieved successfully.", data: await this.committee.getMission(request.user.id, id) };
  }

  @Post("missions/:id/control")
  async control(@Request() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: ControlInvestmentCommitteeMissionDto): Promise<CustomJsonResponse<InvestmentCommitteeMission>> {
    return { status: "success", message: `Investment committee mission ${dto.action} accepted.`, data: await this.committee.controlMission(request.user.id, id, dto.action) };
  }
}
