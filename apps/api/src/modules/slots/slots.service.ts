import { prisma } from "../../shared/lib/prisma.js";
import { BusinessClosedError } from "../../shared/types/errors.js";

interface Slot {
  time: string;
  available: boolean;
  appointmentAt: string;
}

/**
 * Compute available time slots for a given date and service.
 * Pure function — no side effects. Reads from DB but does not mutate.
 * Since the minimum duration per service is 60 minutes at max 90 minutes the maximum available slots is 12, minimum 8((closeTime - openTime) / duration in hours)
 */
export const slotsService = {
  async getAvailableSlots(
    date: string,
    serviceId: string,
  ): Promise<{
    date: string;
    serviceId: string;
    serviceName: string;
    durationMinutes: number;
    totalSlots: number;
    availableSlots: number;
    slots: Slot[];
  }> {
    //YYYY_MM_DD  T(delimiter/seperator)  HH:mm:ss.sssZ(UTC timezone)
    const targetDate = new Date(date + "T00:00:00.000Z"); // data obj for current target
    const dayOfWeek = targetDate.getDay(); // sunday(0) -> saturday(6)

    // Get business hours for this day
    const businessHours = await prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });

    // no business hours or not a working day(mostly sunday)
    if (!businessHours || !businessHours.isActive) {
      throw new BusinessClosedError();
    }

    // Get service duration
    const service = await prisma.nailService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new Error("Service not found");
    }

    const durationMinutes = service.durationMinutes; // 60 -90

    // Parse open/close times
    const openParts = businessHours.openTime.split(":");
    const closeParts = businessHours.closeTime.split(":");
    const openHour = Number(openParts[0]);
    const openMin = Number(openParts[1]);
    const closeHour = Number(closeParts[0]);
    const closeMin = Number(closeParts[1]);

    const dayStart = new Date(targetDate);
    dayStart.setHours(openHour, openMin, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(closeHour, closeMin, 0, 0);

    // Get existing bookings for this date
    const existingBookings = await prisma.booking.findMany({
      where: {
        appointmentAt: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: {
        appointmentAt: true,
        durationMinutes: true,
      },
    });

    // Generate all possible slots (service-duration intervals)
    const slots: Slot[] = [];
    const current = new Date(dayStart);
    // get available slots for a particular day by working in millisecods
    const totalSlotsCount = Math.floor(
      (dayEnd.getTime() - dayStart.getTime()) / (durationMinutes * 60 * 1000),
    );

    while (
      current.getTime() + durationMinutes * 60 * 1000 <=
      dayEnd.getTime()
    ) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60 * 1000);

      // Check if slot overlaps with any existing booking
      const isAvailable = !existingBookings.some((booking: any) => {
        const bookingStart = new Date(booking.appointmentAt).getTime();
        const bookingEnd = bookingStart + booking.durationMinutes * 60 * 1000;
        return (
          current.getTime() < bookingEnd && slotEnd.getTime() > bookingStart
        );
      });

      // Convert to EAT display time (UTC+3)
      const eatHour = current.getUTCHours() + 3;
      const eatMin = current.getUTCMinutes();
      const timeStr = `${String(eatHour).padStart(2, "0")}:${String(eatMin).padStart(2, "0")}`;

      slots.push({
        time: timeStr,
        available: isAvailable,
        appointmentAt: current.toISOString(),
      });

      // Move to next slot (service-duration intervals)
      current.setMinutes(current.getMinutes() + durationMinutes);
    }

    const availableCount = slots.filter((s) => s.available).length;

    return {
      date,
      serviceId,
      serviceName: service.name,
      durationMinutes,
      totalSlots: totalSlotsCount,
      availableSlots: availableCount,
      slots,
    };
  },
};
