import { IsBoolean, IsOptional } from "class-validator";

export class GenerateWealthBriefDto {
  @IsOptional()
  @IsBoolean()
  readonly externalAiOptIn?: boolean;
}
