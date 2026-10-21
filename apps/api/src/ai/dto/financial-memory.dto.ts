import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { FINANCIAL_MEMORY_AGENT_IDS } from "../financial-memory.types";

const CATEGORIES = [
  "preference", "goal", "research_interest", "investment_horizon",
  "risk_preference", "ethical_screening", "research_context",
] as const;

const cleanArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : item)
    : value;

export class UpdateFinancialMemoryProfileDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(12, { each: true }) @Transform(cleanArray)
  readonly preferredCurrencies?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(160, { each: true }) @Transform(cleanArray)
  readonly financialGoals?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) @Transform(cleanArray)
  readonly researchInterests?: string[];
  @IsOptional() @IsString() @MaxLength(80) readonly investmentHorizon?: string | null;
  @IsOptional() @IsString() @MaxLength(80) readonly riskPreference?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(16) @IsString({ each: true }) @MaxLength(120, { each: true }) @Transform(cleanArray)
  readonly ethicalPreferences?: string[];
  @IsOptional() @IsBoolean() readonly shariahScreening?: boolean | null;
  @IsOptional() @IsBoolean() readonly personalizationEnabled?: boolean;
  @IsOptional() @IsBoolean() readonly memorySavingEnabled?: boolean;
  @IsOptional() @IsBoolean() readonly externalAiConsent?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(FINANCIAL_MEMORY_AGENT_IDS, { each: true }) readonly allowedAgentIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) readonly retentionDays?: number;
}

export class CreateFinancialMemoryDto {
  @IsIn(CATEGORIES) readonly category!: (typeof CATEGORIES)[number];
  @IsString() @MinLength(2) @MaxLength(1000) readonly content!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(FINANCIAL_MEMORY_AGENT_IDS, { each: true }) readonly authorizedAgentIds?: string[];
  @IsOptional() @IsISO8601() readonly expiresAt?: string;
}

export class UpdateFinancialMemoryDto {
  @IsOptional() @IsIn(CATEGORIES) readonly category?: (typeof CATEGORIES)[number];
  @IsOptional() @IsString() @MinLength(2) @MaxLength(1000) readonly content?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(FINANCIAL_MEMORY_AGENT_IDS, { each: true }) readonly authorizedAgentIds?: string[];
  @IsOptional() @IsISO8601() readonly expiresAt?: string | null;
}

export class ListFinancialMemoryDto {
  @IsOptional() @IsString() @MaxLength(120) readonly query?: string;
  @IsOptional() @IsIn(CATEGORIES) readonly category?: (typeof CATEGORIES)[number];
}

export class DeleteAllFinancialMemoryDto {
  @IsString() @IsIn(["DELETE MY AI MEMORY"]) readonly confirmation!: string;
}
