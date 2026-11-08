import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  // Staff de la productora que va a trabajar en la barra.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  staffIds?: string[];
}

export class UpdateEventDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class AssignStaffDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  staffIds: string[];
}

export class AddOfferDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceCents: number;

  // Sin stock = sin control de stock.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  stock?: number;
}

export class AddOffersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AddOfferDto)
  products: AddOfferDto[];
}
