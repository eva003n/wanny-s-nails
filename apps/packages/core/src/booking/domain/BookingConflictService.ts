import { MAX_SERVICE_MINUTES, type BookingCandidate } from "../types.js";

export class BookingConflictError extends Error {
  constructor() {
    super("BookingConflict");
    this.name = "BookingConflictError";
  }
}

/**
 * Responsible only for determining slot availability.
 * Pure domain logic — no persistence, no side effects.
 */
export const BookingConflictService = {
  /**
   * Check if a time slot is available given a list of existing bookings.
   * Returns true if the slot is available (no conflict).
   */
  isAvailable(
    start: Date,
    end: Date,
    candidates: BookingCandidate[],
    excludeBookingId?: string,
  ): boolean {
    const hasConflict = candidates.some((b) => {
      const bStart = b.appointmentAt;
      const bEnd = new Date(
        bStart.getTime() + b.durationMinutes * 60 * 1000,
      );
      return bStart < end && bEnd > start;
    });

    return !hasConflict;
  },

  /**
   * Build a bounded query window for fetching candidates.
   * Returns { lowerBound, upperBound } to narrow the DB scan.
   */
  buildQueryWindow(start: Date, end: Date): { lowerBound: Date; upperBound: Date } {
    const lowerBound = new Date(
      start.getTime() - MAX_SERVICE_MINUTES * 60 * 1000,
    );
    return { lowerBound, upperBound: end };
  },
};