import { IsBoolean } from "class-validator";

export class AnalyzeOpportunitiesDto {
  @IsBoolean()
  externalAiOptIn!: boolean;
}
