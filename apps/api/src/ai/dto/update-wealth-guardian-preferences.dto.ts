import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import type {
  HalalScreeningStatus,
  OpportunityCategory,
} from "../opportunity-hunter.types";

const categories: OpportunityCategory[] = [
  "infrastructure",
  "income",
  "payments",
  "privacy",
  "security",
];
const halalStatuses: HalalScreeningStatus[] = [
  "eligible",
  "questionable",
  "excluded",
  "insufficient_evidence",
];

export class UpdateWealthGuardianPreferencesDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  externalAiConsent!: boolean;

  @IsBoolean()
  notificationsEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  morningReportHourUtc!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  minimumOpportunityScore!: number;

  @IsNumber()
  @Min(1)
  @Max(500)
  volatilityAlertPercent!: number;

  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(categories, { each: true })
  categories!: OpportunityCategory[];

  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(halalStatuses, { each: true })
  halalStatuses!: HalalScreeningStatus[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9-]{1,80}$/u, { each: true })
  monitoredAssetIds!: string[];
}
