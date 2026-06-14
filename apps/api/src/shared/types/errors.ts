import { randomUUID } from "crypto";

export class AppError extends Error {
  public readonly requestId: string;

  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly details?:
      | Array<object>
      | object,
    requestId?: string,
  ) {

    super(message);
    this.name = "AppError";
    this.requestId = requestId || randomUUID();
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        requestId: this.requestId,
      },
    };
  }
}

// --- Validation ---
export class ValidationError extends AppError {
  constructor(message: string, details?: Array<object> | object) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

// --- Auth ---
export class UnauthorizedError extends AppError {
  constructor(message = "Missing, expired, or invalid JWT") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient role permissions") {
    super("FORBIDDEN", 403, message);
  }
}

// --- Not Found ---
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", 404, `${resource} not found`);
  }
}

export class BookingNotFoundError extends NotFoundError {
  constructor(reference?: string) {
    super(reference ? `Booking ${reference}` : "Booking");
  }
}

export class CustomerNotFoundError extends NotFoundError {
  constructor(identifier?: string) {
    super(identifier ? `Customer ${identifier}` : "Customer");
  }
}

export class ServiceNotFoundError extends NotFoundError {
  constructor() {
    super("Salon service");
  }
}

// --- Gone ---
export class GoneError extends AppError {
  constructor(resource: string) {
    super("GONE", 410, `${resource} was permanently deleted`);
  }
}

// --- Conflict ---
export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: Array<object> | object) {
    super(code, 409, message, details);
  }
}

export class BookingConflictError extends ConflictError {
  constructor() {
    super("BOOKING_SLOT_UNAVAILABLE", "The selected time slot is no longer available");
  }
}

export class InvalidStatusTransitionError extends ConflictError {
  constructor(currentStatus: string, targetAction: string) {
    super(
      "INVALID_STATUS_TRANSITION",
      `Cannot ${targetAction} a booking in ${currentStatus} status`,
      { currentStatus, targetAction }
    );
  }
}

export class PhoneAlreadyExistsError extends ConflictError {
  constructor() {
    super("PHONE_ALREADY_EXISTS", "A customer with this phone number already exists");
  }
}

export class EmailAlreadyExistsError extends ConflictError {
  constructor() {
    super("EMAIL_ALREADY_EXISTS", "A customer with this email already exists");
  }
}

// --- Unprocessable ---
export class UnprocessableError extends AppError {
  constructor(code: string, message: string, details?: Array<object> | object) {
    super(code, 422, message, details);
  }
}

export class OutsideBusinessHoursError extends UnprocessableError {
  constructor(appointmentAt: string) {
    super("OUTSIDE_BUSINESS_HOURS", "The selected time is outside configured business hours", {
      appointmentAt,
    });
  }
}

export class BusinessClosedError extends UnprocessableError {
  constructor() {
    super("BUSINESS_CLOSED", "The salon is closed on the requested date");
  }
}

export class ServiceInactiveError extends UnprocessableError {
  constructor() {
    super("SERVICE_INACTIVE", "The selected service is not currently active");
  }
}

export class PaymentNotAllowedError extends UnprocessableError {
  constructor(reason: string) {
    super("PAYMENT_NOT_ALLOWED", reason);
  }
}

export class ServiceHasFutureBookingsError extends UnprocessableError {
  constructor() {
    super(
      "SERVICE_HAS_FUTURE_BOOKINGS",
      "Cannot delete a service with upcoming confirmed bookings"
    );
  }
}

// --- Rate Limited ---
export class RateLimitedError extends AppError {
  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED", 429, "Too many requests. Please wait before retrying.", {
      retryAfterSeconds,
    });
  }
}

// --- Server Errors ---
export class InternalError extends AppError {
  constructor(message = "Unexpected server error") {
    super("INTERNAL_ERROR", 500, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(serviceName: string, retryAfterSeconds = 60) {
    super("SERVICE_UNAVAILABLE", 503, `${serviceName} is temporarily unavailable`, {
      retryAfterSeconds,
    });
  }
}

// --- Payment ---
export class PaymentFailedError extends AppError {
  constructor(mpesaCode: number) {
    super("PAYMENT_FAILED", 402, "M-Pesa payment was not completed", { mpesaCode });
  }
}