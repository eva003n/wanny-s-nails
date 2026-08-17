import type { ServiceData } from "../types.js";

export interface ServiceRepository {
  findById(id: string): Promise<ServiceData | null>;
}