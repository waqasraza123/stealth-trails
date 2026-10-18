import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PortfolioRiskInputDto } from "./analyze-portfolio-risk.dto";

export class SendCopilotMessageDto {
  @IsOptional()
  @IsString()
  readonly conversationId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  readonly message!: string;

  @IsOptional()
  @IsBoolean()
  readonly externalAiOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly searchDocuments?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly documentId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PortfolioRiskInputDto)
  readonly portfolioRiskContext?: PortfolioRiskInputDto;
}
