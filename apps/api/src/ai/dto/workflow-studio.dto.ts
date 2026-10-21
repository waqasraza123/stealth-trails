import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { WorkflowDefinition, WorkflowTriggerType } from "../workflow-studio.types";

export class CreateWorkflowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  externalAiConsent!: boolean;

  @IsIn(["manual", "schedule", "data_change"] satisfies WorkflowTriggerType[])
  triggerType!: WorkflowTriggerType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(43_200)
  intervalMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  maxConcurrentRuns?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(45)
  timeoutSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  retryLimit?: number;

  @IsObject()
  definition!: WorkflowDefinition;
}

export class UpdateWorkflowDto extends CreateWorkflowDto {}

export class SetWorkflowEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class CreateStarterWorkflowDto {
  @IsIn(["portfolio-risk-review", "investment-research", "document-analysis"])
  starterId!: "portfolio-risk-review" | "investment-research" | "document-analysis";

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}

export class ListWorkflowRunsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RunWorkflowWorkerDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}

