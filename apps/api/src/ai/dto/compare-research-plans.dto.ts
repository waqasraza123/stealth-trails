import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";

export class CompareResearchPlansDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  planIds!: string[];
}
