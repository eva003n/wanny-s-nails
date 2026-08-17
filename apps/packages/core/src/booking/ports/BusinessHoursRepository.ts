import type { BusinessHoursData } from "../types.js";

export interface BusinessHoursRepository {
  findByDayOfWeek(dayOfWeek: number): Promise<BusinessHoursData | null>;
}