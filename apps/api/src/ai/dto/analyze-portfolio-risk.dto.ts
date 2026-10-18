import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class PortfolioRiskAllocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  opportunityId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  percent!: number;
}

export class PortfolioRiskInputDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PortfolioRiskAllocationDto)
  allocations!: PortfolioRiskAllocationDto[];

  @IsNumber()
  @Min(0)
  @Max(10_000_000_000)
  portfolioValueUsd!: number;
}

export class AnalyzePortfolioRiskDto extends PortfolioRiskInputDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PortfolioRiskInputDto)
  hypothetical?: PortfolioRiskInputDto;
}
