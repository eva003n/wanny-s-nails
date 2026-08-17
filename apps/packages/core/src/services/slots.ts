import type { PrismaClient } from "../lib/prisma.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;

export interface Slot {
  time: string;
  available: boolean;
  appointmentAt: string;
}

export const BOOKING_CONFIG = {
  slotIntervalMinutes: 15,
  minimumNoticeMinutes: 30,
  maxAdvanceDays: 30,
  bufferBetweenAppointmentsMinutes: 10,
};

const roundUp = (
  date: Date,
  intervalMinutes: number = BOOKING_CONFIG.slotIntervalMinutes,
) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
};

const isToday = (someDate: Date) => {
  const today = new Date();
  return (
    someDate.getDate() === today.getDate() &&
    someDate.getMonth() === today.getMonth() &&
    someDate.getFullYear() === today.getFullYear()
  );
};

/**
 * Compute available time slots for a given date and service.
 * Pure function — no side effects. Reads from DB but does not mutate.
 * Candidates are generated every `slotIntervalMinutes`, then filtered to
 * ones where the full service duration fits before closing, respects the
 * minimum notice period, and doesn't overlap an existing booking (padded
 * with `bufferBetweenAppointmentsMinutes` on both sides).
 *
 * @param prisma - An instance of PrismaClient (created per-app with its own config)
 */
export async function getAvailableSlots(
  prisma: PrismaClientLike,
  date: string,
  serviceIds: string,
): Promise<{
  date: string;
  // serviceId: string;
  // serviceName: string;
  durationMinutes: number;
  totalSlots: number;
  availableSlots: number;
  slots: Slot[];
}> {
  // YYYY-MM-DD  T (delimiter/separator)  HH:mm:ss.sssZ (UTC timezone)
  const targetDate = new Date(date + "T00:00:00.000Z"); // ISO format for the target date in UTC
  const dayOfWeek = targetDate.getDay(); // sunday(0) -> saturday(6)

  // Get business hours for target day of the week
  const businessHours = await prisma.businessHours.findUnique({
    where: { dayOfWeek },
  });

  // no business hours or not a working day (mostly sunday)
  if (!businessHours || !businessHours.isActive) {
    throw new Error("The salon is closed on the requested date");
  }

  const ids = serviceIds.split(",")
  // Get service duration per service
  const services = await prisma.nailService.findMany({
    where: { id: { in: ids} },
  });

  if (services.length === 0) {
    throw new Error("Service not found");
  }

  const totalDurationMinutes = services.filter((s: any) => s !== null).reduce((sum: number, s: any) => sum + s.durationMinutes, 0); 

  // Parse open/close times
  const openParts = businessHours.openTime.split(":"); // ["07", "00"]
  const closeParts = businessHours.closeTime.split(":"); // ["19", "00"]
  const openHour = Number(openParts[0]); // 7
  const openMin = Number(openParts[1]); // 0
  const closeHour = Number(closeParts[0]); // 19
  const closeMin = Number(closeParts[1]); // 0

  // day start and day end
  const dayStart = new Date(targetDate);
  dayStart.setHours(openHour, openMin, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setHours(closeHour, closeMin, 0, 0);

  // Get existing bookings for a particular date
  const existingBookings = await prisma.booking.findMany({
    where: {
      appointmentAt: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: { notIn: ["CANCELLED", "NO_SHOW",] },
    },
    select: {
      appointmentAt: true,
      durationMinutes: true,
    },
  });

  // Timing constants (in ms)
  const minimumNoticeMs = BOOKING_CONFIG.minimumNoticeMinutes * 60 * 1000;
  const bufferMs =
    BOOKING_CONFIG.bufferBetweenAppointmentsMinutes * 60 * 1000;
  const intervalMs = BOOKING_CONFIG.slotIntervalMinutes * 60 * 1000;
  const durationMs = totalDurationMinutes * 60 * 1000;

  // First candidate start time: today respects minimum notice, future days start at open
  let current = isToday(dayStart)
    ? roundUp(new Date(Date.now() + minimumNoticeMs))
    : roundUp(dayStart);

  // Pre-pad existing bookings with the buffer on both sides, once, outside the loop
  const paddedBookings = existingBookings.map((booking: { appointmentAt: string | Date; durationMinutes: number }) => {
    const bookingStart = new Date(booking.appointmentAt).getTime();
    const bookingEnd = bookingStart + booking.durationMinutes * 60 * 1000;
    return {
      start: bookingStart - bufferMs,
      end: bookingEnd + bufferMs,
    };
  });

  // Generate all candidate slots at slotIntervalMinutes granularity
  const slots: Slot[] = [];

  while (current.getTime() + durationMs <= dayEnd.getTime()) {
    const slotEndMs = current.getTime() + durationMs;

    // Check if slot overlaps with any existing (buffer-padded) booking
    const isAvailable = !paddedBookings.some(
      (booking: { start: number; end: number }) =>
        current.getTime() < booking.end && slotEndMs > booking.start,
    );

    // Convert to EAT display time (UTC+3)
    const eatHour = (current.getUTCHours() + 3) % 24;
    const eatMin = current.getUTCMinutes();
    const timeStr = `${String(eatHour).padStart(2, "0")}:${String(eatMin).padStart(2, "0")}`; // "00:00"

    slots.push({
      time: timeStr,
      available: isAvailable,
      appointmentAt: current.toISOString(),
    });

    // Move to next candidate (step by granularity, not by service duration)
    current = new Date(current.getTime() + intervalMs);
  }

  const availableCount = slots.filter((s) => s.available).length;

  return {
    date,
    // serviceId,
    // serviceName: service.name,
    durationMinutes: totalDurationMinutes,
    totalSlots: slots.length,
    availableSlots: availableCount,
    slots,
  };
}