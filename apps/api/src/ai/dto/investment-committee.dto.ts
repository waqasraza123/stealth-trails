import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import type { ResearchRiskTolerance } from "../research-plan.types";

class CommitteeAllocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  opportunityId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  percent!: number;
}

export class StartInvestmentCommitteeMissionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  goal!: string;

  @IsBoolean()
  externalAiConsent!: boolean;

  @IsNumber()
  @Min(1)
  @Max(1_000_000_000)
  portfolioValueUsd!: number;

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CommitteeAllocationDto)
  allocations?: CommitteeAllocationDto[];
}

export class ControlInvestmentCommitteeMissionDto {
  @IsIn(["pause", "resume", "cancel", "approve"])
  action!: "pause" | "resume" | "cancel" | "approve";
}
