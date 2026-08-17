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

    const dayOpen = new Date(start);
    dayOpen.setHours(openHour as number, openMinute, 0, 0);

    const dayClose = new Date(start);
    dayClose.setHours(closeHour as number, closeMinute, 0, 0);

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