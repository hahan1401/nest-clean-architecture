import type { Tour } from '@app/database';
import type { ListRange } from '../models/pagination';

export interface CreateTourData {
  slug: string;
  name: string;
  description: string | null;
  durationDays: number;
  basePricePerPerson: number;
}

export interface TourListFilter extends ListRange {
  isActive?: boolean;
}

export abstract class TourRepository {
  abstract create(data: CreateTourData): Promise<Tour>;
  abstract findById(id: number): Promise<Tour | null>;
  abstract findBySlug(slug: string): Promise<Tour | null>;
  abstract findMany(filter: TourListFilter): Promise<Tour[]>;
}
