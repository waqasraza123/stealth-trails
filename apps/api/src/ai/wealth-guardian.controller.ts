import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GenerateWealthGuardianReportDto } from "./dto/generate-wealth-guardian-report.dto";
import { UpdateWealthGuardianPreferencesDto } from "./dto/update-wealth-guardian-preferences.dto";
import { WealthGuardianService } from "./wealth-guardian.service";
import type { WealthGuardianDashboard } from "./wealth-guardian.types";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizeGuardianRun } from "./agent-observatory.summaries";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/wealth-guardian")
export class WealthGuardianController {
  constructor(
    private readonly wealthGuardian: WealthGuardianService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  @Get()
  async getDashboard(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<WealthGuardianDashboard>> {
    return {
      status: "success",
      message: "Wealth Guardian dashboard retrieved successfully.",
      data: await this.wealthGuardian.getDashboard(request.user.id),
    };
  }

  @Patch("preferences")
  async updatePreferences(
    @Request() request: AuthenticatedRequest,
    @Body() dto: UpdateWealthGuardianPreferencesDto,
  ): Promise<CustomJsonResponse<WealthGuardianDashboard>> {
    return {
      status: "success",
      message: "Wealth Guardian preferences updated successfully.",
      data: await this.wealthGuardian.updatePreferences(request.user.id, dto),
    };
  }

  @Post("reports")
  async generateReport(
    @Request() request: AuthenticatedRequest,
    @Body() dto: GenerateWealthGuardianReportDto,
  ): Promise<CustomJsonResponse<WealthGuardianDashboard>> {
    return {
      status: "success",
      message: "Wealth Guardian report generated successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "wealth-guardian",
        workflow: "generate_manual_guardian_report",
        execute: () => this.wealthGuardian.generateManualReport(
          request.user.id,
          dto.externalAiOptIn,
        ),
        summarize: summarizeGuardianRun,
      }),
    };
  }
}
