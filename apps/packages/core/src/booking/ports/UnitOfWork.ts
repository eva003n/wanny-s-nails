/**
 * Transaction abstraction to keep Prisma as an infrastructure detail.
 *
 * The `ctx` parameter represents the transactional context (e.g. a Prisma
 * transaction client) and is passed through to repository methods that
 * need to participate in the transaction.
 */
export interface UnitOfWork {
  /**
   * Execute a function within a database transaction.
   * The `ctx` is opaque to domain code and is resolved by the infrastructure layer.
   */
  execute<T>(fn: (ctx: unknown) => Promise<T>): Promise<T>;
}