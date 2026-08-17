import type { CustomerData } from "../types.js";

export interface CustomerRepository {
  findById(id: string): Promise<CustomerData | null>;
}