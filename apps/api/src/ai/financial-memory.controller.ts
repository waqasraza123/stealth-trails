import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import {
  CreateFinancialMemoryDto,
  DeleteAllFinancialMemoryDto,
  ListFinancialMemoryDto,
  UpdateFinancialMemoryDto,
  UpdateFinancialMemoryProfileDto,
} from "./dto/financial-memory.dto";
import { FinancialMemoryService } from "./financial-memory.service";
import type { FinancialMemoryDashboard, FinancialMemoryEntry, FinancialMemoryProfile } from "./financial-memory.types";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/memory")
export class FinancialMemoryController {
  constructor(private readonly memory: FinancialMemoryService) {}

  @Get()
  async dashboard(@Request() request: AuthenticatedRequest, @Query() query: ListFinancialMemoryDto): Promise<CustomJsonResponse<FinancialMemoryDashboard>> {
    return { status: "success", message: "AI financial memory retrieved successfully.", data: await this.memory.dashboard(request.user.id, query) };
  }

  @Put("profile")
  async updateProfile(@Request() request: AuthenticatedRequest, @Body() dto: UpdateFinancialMemoryProfileDto): Promise<CustomJsonResponse<FinancialMemoryProfile>> {
    return { status: "success", message: "AI personalization settings updated successfully.", data: await this.memory.updateProfile(request.user.id, dto) };
  }

  @Post("entries")
  async create(@Request() request: AuthenticatedRequest, @Body() dto: CreateFinancialMemoryDto): Promise<CustomJsonResponse<FinancialMemoryEntry>> {
    return { status: "success", message: "Memory saved with your explicit authorization.", data: await this.memory.create(request.user.id, dto) };
  }

  @Patch("entries/:id")
  async update(@Request() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateFinancialMemoryDto): Promise<CustomJsonResponse<FinancialMemoryEntry>> {
    return { status: "success", message: "Memory updated successfully.", data: await this.memory.update(request.user.id, id, dto) };
  }

  @Delete("entries/:id")
  async remove(@Request() request: AuthenticatedRequest, @Param("id") id: string): Promise<CustomJsonResponse<null>> {
    await this.memory.remove(request.user.id, id);
    return { status: "success", message: "Memory deleted successfully.", data: null };
  }

  @Get("export")
  async export(@Request() request: AuthenticatedRequest): Promise<CustomJsonResponse<Awaited<ReturnType<FinancialMemoryService["export"]>>>> {
    return { status: "success", message: "AI memory export generated successfully.", data: await this.memory.export(request.user.id) };
  }

  @Delete()
  async deleteAll(@Request() request: AuthenticatedRequest, @Body() dto: DeleteAllFinancialMemoryDto): Promise<CustomJsonResponse<null>> {
    void dto.confirmation;
    await this.memory.deleteAll(request.user.id);
    return { status: "success", message: "All AI memory and personalization settings were permanently deleted.", data: null };
  }
}
