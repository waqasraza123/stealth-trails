import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const optionalBoolean = ({ value }: { value: unknown }) =>
  value === true || value === "true";

export class ListFinancialDocumentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  readonly query?: string;
}

export class UploadFinancialDocumentDto {
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  readonly externalAiConsent?: boolean;
}

export class ProcessFinancialDocumentDto {
  @Transform(optionalBoolean)
  @IsBoolean()
  readonly externalAiConsent!: boolean;
}

export class SearchFinancialDocumentsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  readonly query!: string;

  @IsOptional()
  @IsString()
  readonly documentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  readonly limit?: number;

  @Transform(optionalBoolean)
  @IsBoolean()
  readonly externalAiConsent!: boolean;
}

export class ChatWithDocumentsDto extends SearchFinancialDocumentsDto {}

export class DocumentIntelligenceDto {
  @Transform(optionalBoolean)
  @IsBoolean()
  readonly externalAiConsent!: boolean;
}

export class CompareFinancialDocumentsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  readonly documentIds!: string[];

  @Transform(optionalBoolean)
  @IsBoolean()
  readonly externalAiConsent!: boolean;
}
