// Booking module — layered architecture
// Application
export { BookingApplicationService } from "./application/BookingApplicationService.js";
export type { CreateBookingResult } from "./application/BookingApplicationService.js";

// Domain
export { BookingDomainService } from "./domain/BookingDomainService.js";
export type { BookingDomainServiceDeps, ValidatedBooking } from "./domain/BookingDomainService.js";
export { ServiceInactiveError, CustomerNotFoundError } from "./domain/BookingDomainService.js";
export { BookingPolicy } from "./domain/BookingPolicy.js";
export {
  SlotAlignmentError,
  OutsideBusinessHoursError,
  BusinessClosedError,
  MinimumNoticeError,
} from "./domain/BookingPolicy.js";
export { BookingConflictService, BookingConflictError } from "./domain/BookingConflictService.js";

// Ports
export type {
  BookingRepository,
  CreateBookingRecord,
  ServiceRepository,
  CustomerRepository,
  BusinessHoursRepository,
  UnitOfWork,
} from "./ports/index.js";

// Infrastructure
export {
  PrismaBookingRepository,
  PrismaServiceRepository,
  PrismaCustomerRepository,
  PrismaBusinessHoursRepository,
  PrismaUnitOfWork,
} from "./infrastructure/index.js";

// Types
export type {
  CreateBookingInput,
  CancelBookingInput,
  RescheduleBookingInput,
  BookingResult,
  ServiceData,
  CustomerData,
  BusinessHoursData,
  BookingCandidate,
  StatusHistoryEntry,
  ActorType
} from "./types.js";
export { SLOT_GRANULARITY_MINUTES, MAX_SERVICE_MINUTES } from "./types.js";
