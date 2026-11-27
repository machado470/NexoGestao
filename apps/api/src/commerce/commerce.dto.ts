import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsDateString,
} from "class-validator";
export class ProductDto {
  @IsOptional() @IsIn(["SIMPLE", "PARENT", "VARIANT"])
  kind?: "SIMPLE" | "PARENT" | "VARIANT";
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,63}$/i)
  parentSku?: string;
  @IsString() @Matches(/^[A-Z]{3}$/) expectedCurrency!: string;
  @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,63}$/i) sku!: string;
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(64) barcode?: string;
  @IsOptional() @IsString() @MaxLength(100) variant?: string;
  @IsInt() @Min(0) @Max(1000000000) minQuantity!: number;
  @IsInt() @Min(0) @Max(2147483647) costCents!: number;
  @IsInt() @Min(0) @Max(2147483647) saleCents!: number;
}
export class EntryDto {
  @IsString() @MinLength(8) @MaxLength(100) entryKey!: string;
}
export class ReserveStockDto extends EntryDto {
  @IsString() @MinLength(1) @MaxLength(100) productId!: string;
  @IsString() @MinLength(1) @MaxLength(100) serviceOrderId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
}
export class MovementDto extends EntryDto {
  @IsString() @MinLength(1) @MaxLength(100) productId!: string;
  @IsIn(["IN", "OUT"]) direction!: "IN" | "OUT";
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(100) serviceOrderId?: string;
}
export class FiscalDraftDto extends EntryDto {
  @IsString() @Matches(/^[A-Z]{3}$/) expectedCurrency!: string;
  @IsString() @MinLength(1) @MaxLength(100) customerId!: string;
  @IsOptional() @IsString() @MaxLength(100) serviceOrderId?: string;
  @IsString() @MinLength(5) @MaxLength(3000) description!: string;
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
}
export class RecordedExpenseDto extends EntryDto {
  @IsString() @Matches(/^[A-Z]{3}$/) expectedCurrency!: string;
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
  @IsDateString() occurredAt!: string;
}

export class ExpenseCurrencyDto {
  @IsString() @MinLength(1) @MaxLength(100) id!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
}
