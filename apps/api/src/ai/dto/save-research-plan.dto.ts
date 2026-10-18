import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { ResearchRiskTolerance } from "../research-plan.types";

class ResearchPlanGoalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective!: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  initialAmountUsd!: number;

  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  monthlyContributionUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000_000)
  targetAmountUsd!: number | null;

  @IsInt()
  @Min(1)
  @Max(600)
  horizonMonths!: number;

  @IsIn(["conservative", "balanced", "growth"] satisfies ResearchRiskTolerance[])
  riskTolerance!: ResearchRiskTolerance;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  ethicalPreferences!: string[];
}

class ResearchPlanAllocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  opportunityId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  percent!: number;
}

export class SaveResearchPlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceConversationId?: string;

  @IsBoolean()
  externalAiOptIn!: boolean;

  @ValidateNested()
  @IsDefined()
  @Type(() => ResearchPlanGoalDto)
  goal!: ResearchPlanGoalDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ResearchPlanAllocationDto)
  allocations!: ResearchPlanAllocationDto[];
}
