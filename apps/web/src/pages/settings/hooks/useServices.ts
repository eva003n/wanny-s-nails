/**
 * Re-exports service hooks from the shared hooks location.
 *
 * These are the canonical hooks used by the services settings section.
 * The underlying implementation lives at @/hooks/useServices.ts to avoid
 * cache fragmentation (different query keys = invalidate bugs).
 */
export {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  serviceKeys,
} from "@/hooks/useServices";