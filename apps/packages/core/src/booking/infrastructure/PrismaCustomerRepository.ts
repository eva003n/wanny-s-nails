// Accept any PrismaClient-like object to be compatible with extended clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;
import type { CustomerRepository } from "../ports/CustomerRepository.js";
import type { CustomerData } from "../types.js";

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findById(id: string): Promise<CustomerData | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) return null;
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    };
  }
}