import { IsBoolean } from "class-validator";

export class GenerateWealthGuardianReportDto {
  @IsBoolean()
  externalAiOptIn!: boolean;
}
