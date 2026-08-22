import {
  SLOT_GRANULARITY_MINUTES,
  type BusinessHoursData,
} from "../types.js";

export class SlotAlignmentError extends Error {
  constructor() {
    super("SlotAlignment");
    this.name = "SlotAlignmentError";
  }
}

export class OutsideBusinessHoursError extends Error {
  constructor(appointmentAt: string) {
    super("OutsideBusinessHours");
    this.name = "OutsideBusinessHoursError";
    this.appointmentAt = appointmentAt;
  }
  readonly appointmentAt: string;
}

export class BusinessClosedError extends Error {
  constructor() {
    super("BusinessClosed");
    this.name = "BusinessClosedError";
  }
}

export class MinimumNoticeError extends Error {
  constructor() {
    super("MinimumNotice");
    this.name = "MinimumNoticeError";
  }
}

// The salon operates on a single fixed timezone (EAT, UTC+3, no DST) regardless
// of the OS/process timezone the code happens to run under.
const SALON_TIMEZONE = "Africa/Nairobi";
const SALON_UTC_OFFSET_MINUTES = 3 * 60;

function salonDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Converts a salon-local wall-clock time (Y-M-D + H:M in Africa/Nairobi) to the
// UTC instant it represents.
function salonWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utcMillis =
    Date.UTC(year, month - 1, day, hour, minute) - SALON_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis);
}

/**
 * Stateless policy/validator for booking business rules.
 * Reusable across create, reschedule, admin actions, and WhatsApp flows.
 */
export const BookingPolicy = {
  /**
   * Assert that the appointment time aligns to the salon's fixed booking grid.
   */
  assertSlotAlignment(start: Date): void {
    const totalMinutes = start.getHours() * 60 + start.getMinutes();
    if (totalMinutes % SLOT_GRANULARITY_MINUTES !== 0) {
      throw new SlotAlignmentError();
    }
  },

  /**
   * Assert that the appointment falls within configured business hours.
   * Compares full start/end timestamps, not just the hour.
   */
  assertWithinBusinessHours(
    start: Date,
    end: Date,
    businessHours: BusinessHoursData,
  ): void {
    if (!businessHours.isActive) {
      throw new BusinessClosedError();
    }

    const [openHour, openMinute = 0] = businessHours.openTime
      .split(":")
      .map(Number);
    const [closeHour, closeMinute = 0] = businessHours.closeTime
      .split(":")
      .map(Number);

    const { year, month, day } = salonDateParts(start);
    const dayOpen = salonWallTimeToUtc(year, month, day, openHour as number, openMinute);
    const dayClose = salonWallTimeToUtc(year, month, day, closeHour as number, closeMinute);

    if (start < dayOpen || end > dayClose) {
      throw new OutsideBusinessHoursError(start.toISOString());
    }
  },

  /**
   * Assert that the appointment is at least `minutes` in the future.
   */
  assertMinimumNotice(start: Date, minutes = 60): void {
    const now = new Date();
    const minStart = new Date(now.getTime() + minutes * 60 * 1000);
    if (start < minStart) {
      throw new MinimumNoticeError();
    }
  },
};