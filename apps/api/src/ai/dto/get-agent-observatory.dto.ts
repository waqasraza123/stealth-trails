import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class GetAgentObservatoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  hours?: number = 168;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  agentId?: string;

  @IsOptional()
  @IsIn(["succeeded", "failed", "fallback", "running"])
  status?: "succeeded" | "failed" | "fallback" | "running";
}
