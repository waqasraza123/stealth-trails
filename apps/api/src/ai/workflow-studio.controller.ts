import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import {
  CreateStarterWorkflowDto,
  CreateWorkflowDto,
  ListWorkflowRunsDto,
  RunWorkflowWorkerDto,
  SetWorkflowEnabledDto,
  UpdateWorkflowDto,
} from "./dto/workflow-studio.dto";
import { WorkflowStudioService } from "./workflow-studio.service";
import type {
  WorkflowRun,
  WorkflowStudioDashboard,
  WorkflowSummary,
  WorkflowWorkerSweepResult,
} from "./workflow-studio.types";

type AuthenticatedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("ai/workflows")
export class WorkflowStudioController {
  constructor(private readonly workflows: WorkflowStudioService) {}

  @Get()
  async dashboard(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<WorkflowStudioDashboard>> {
    return {
      status: "success",
      message: "AI workflow studio retrieved successfully.",
      data: await this.workflows.dashboard(request.user.id),
    };
  }

  @Post()
  async create(
    @Request() request: AuthenticatedRequest,
    @Body() dto: CreateWorkflowDto,
  ): Promise<CustomJsonResponse<WorkflowSummary>> {
    return {
      status: "success",
      message: "AI workflow created successfully.",
      data: await this.workflows.create(request.user.id, dto),
    };
  }

  @Post("starters")
  async createStarter(
    @Request() request: AuthenticatedRequest,
    @Body() dto: CreateStarterWorkflowDto,
  ): Promise<CustomJsonResponse<WorkflowSummary>> {
    return {
      status: "success",
      message: "Starter workflow created in a disabled state for review.",
      data: await this.workflows.createStarter(request.user.id, dto.starterId, dto.name),
    };
  }

  @Put(":workflowId")
  async update(
    @Request() request: AuthenticatedRequest,
    @Param("workflowId") workflowId: string,
    @Body() dto: UpdateWorkflowDto,
  ): Promise<CustomJsonResponse<WorkflowSummary>> {
    return {
      status: "success",
      message: "AI workflow updated successfully.",
      data: await this.workflows.update(request.user.id, workflowId, dto),
    };
  }

  @Patch(":workflowId/enabled")
  async enabled(
    @Request() request: AuthenticatedRequest,
    @Param("workflowId") workflowId: string,
    @Body() dto: SetWorkflowEnabledDto,
  ): Promise<CustomJsonResponse<WorkflowSummary>> {
    return {
      status: "success",
      message: `AI workflow ${dto.enabled ? "enabled" : "disabled"} successfully.`,
      data: await this.workflows.setEnabled(request.user.id, workflowId, dto.enabled),
    };
  }

  @Delete(":workflowId")
  async remove(
    @Request() request: AuthenticatedRequest,
    @Param("workflowId") workflowId: string,
  ): Promise<CustomJsonResponse<null>> {
    await this.workflows.remove(request.user.id, workflowId);
    return { status: "success", message: "AI workflow deleted; run history was retained.", data: null };
  }

  @Post(":workflowId/runs")
  async run(
    @Request() request: AuthenticatedRequest,
    @Param("workflowId") workflowId: string,
  ): Promise<CustomJsonResponse<WorkflowRun>> {
    return {
      status: "success",
      message: "AI workflow queued for worker execution.",
      data: await this.workflows.enqueueManual(request.user.id, workflowId),
    };
  }

  @Get(":workflowId/runs")
  async runs(
    @Request() request: AuthenticatedRequest,
    @Param("workflowId") workflowId: string,
    @Query() query: ListWorkflowRunsDto,
  ): Promise<CustomJsonResponse<WorkflowRun[]>> {
    return {
      status: "success",
      message: "AI workflow run history retrieved successfully.",
      data: await this.workflows.listRuns(request.user.id, workflowId, query.limit),
    };
  }

  @Get("executions/:runId")
  async runDetail(
    @Request() request: AuthenticatedRequest,
    @Param("runId") runId: string,
  ): Promise<CustomJsonResponse<WorkflowRun>> {
    return {
      status: "success",
      message: "AI workflow run retrieved successfully.",
      data: await this.workflows.getRun(request.user.id, runId),
    };
  }

  @Post("executions/:runId/approve")
  async approve(
    @Request() request: AuthenticatedRequest,
    @Param("runId") runId: string,
  ): Promise<CustomJsonResponse<WorkflowRun>> {
    return {
      status: "success",
      message: "Approval recorded and the workflow run was re-queued.",
      data: await this.workflows.approve(request.user.id, runId),
    };
  }

  @Post("executions/:runId/cancel")
  async cancel(
    @Request() request: AuthenticatedRequest,
    @Param("runId") runId: string,
  ): Promise<CustomJsonResponse<WorkflowRun>> {
    return {
      status: "success",
      message: "Workflow run cancelled successfully.",
      data: await this.workflows.cancel(request.user.id, runId),
    };
  }
}

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("ai/workflows/internal/worker")
export class WorkflowStudioWorkerController {
  constructor(private readonly workflows: WorkflowStudioService) {}

  @Post("run-due")
  async runDue(
    @Request() request: { internalWorker: { workerId: string } },
    @Body() dto: RunWorkflowWorkerDto,
  ): Promise<CustomJsonResponse<WorkflowWorkerSweepResult>> {
    return {
      status: "success",
      message: "Due AI workflows were evaluated and bounded worker claims were processed.",
      data: await this.workflows.runWorkerSweep(request.internalWorker.workerId, dto.limit ?? 10),
    };
  }
}

