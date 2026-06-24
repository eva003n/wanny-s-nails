import { prisma } from "@wannys-nails/packages";
import type {Prisma} from "@wannys-nails/packages"
import type { DateOption, Slot } from "./types.js";


/**
 * EAT (UTC+3) offset in milliseconds.
 */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Get the current time in EAT as a Date object.
 */
export function nowInEAT(): Date {
  const now = new Date();
  return new Date(now.getTime() + EAT_OFFSET_MS);
}

/**
 * Format a UTC ISO string as a readable date in EAT.
 * e.g. "Thursday, 5 June 2025"
 */
export function formatDateEAT(isoDate: string): string {
  const date = new Date(isoDate);
  // Add EAT offset
  const eatDate = new Date(date.getTime() + EAT_OFFSET_MS);
  return eatDate.toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format date as short EAT label for menu.
 * e.g. "Today (Thu 5 Jun)" or "Fri 6 Jun"
 */
export function formatDateShortEAT(date: Date, isToday: boolean): string {
  const day = date.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return isToday ? `Today (${day})` : day;
}

/**
 * Truncate a string to a max length, appending "…" if needed.
 * Used to enforce WhatsApp interactive list row title limits (24 chars).
 */
export function truncateTitle(text: string, max = 24): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/**
 * Format time string (HH:mm) to 12-hour format.
 * e.g. "14:00" → "2:00 PM"
 */
export function formatTime12h(time24: string): string {
  const parts = time24.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Parse a Kenyan phone number to E.164 format.
 * Accepts formats like: 0712345678, +254712345678, 254712345678
 * Returns null if invalid.
 */
export function parsePhoneToE164(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, "");

  // Already E.164
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Local format: 0712345678 or 012345678
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`;
  }

  // Without leading +254 or 0: 254712345678
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Validate that a phone number is a valid Kenyan number.
 */
export function isValidKenyanPhone(input: string): boolean {
  return parsePhoneToE164(input) !== null;
}

  async function getAvailableSlots(
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
      throw new Error("The salon is closed on the requested date");
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
      const eatHour = (current.getUTCHours() + 3) % 24;
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
  }
/**
 * Build the next 7 business days (skip closed days) as DateOptions
 * with slot counts for a given service.
 */
export async function buildDateOptions(
  serviceId: string,
): Promise<DateOption[]> {
  const options: DateOption[] = [];
  const today = new Date();
  // Start from tomorrow in EAT
  const tomorrow = new Date(today.getTime() + EAT_OFFSET_MS);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let dayOffset = 0;
  let attempts = 0;
  const maxAttempts = 14; // look up to 14 days out to find 7 available

  while (options.length < 7 && attempts < maxAttempts) {
    const candidateDate = new Date(tomorrow);
    candidateDate.setDate(candidateDate.getDate() + dayOffset);
    attempts++;

    const dayOfWeek = candidateDate.getDay();

    // Check if day is a business day
    const businessHours = await prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });

    if (!businessHours || !businessHours.isActive) {
      dayOffset++;
      continue;
    }

    // Get slot availability for this day
    const dateStr = candidateDate.toISOString().split("T")[0]!;
    try {

  
      const slotData = await getAvailableSlots(dateStr, serviceId);
      const availableCount = slotData.availableSlots;
      const isFull = availableCount === 0;

      const isToday =
        candidateDate.toISOString().split("T")[0] ===
        today.toISOString().split("T")[0];

      options.push({
        label: formatDateShortEAT(candidateDate, isToday),
        date: dateStr,
        availableSlots: availableCount,
        isFull,
      });
    } catch {
      // Skip dates that error (shouldn't happen if business hours are correct)
    }

    dayOffset++;
  }

  return options;
}

/**
 * Look up a customer by phone without creating a record.
 * Returns null if no customer found.
 */
 export const getByPhone = async(phone: string) => {
    return prisma.customer.findUnique({ where: { phone } });
  }
export async function findCustomerByPhone(
  phone: string,
): Promise<{
  id: string;
  name: string;
  phone: string;
  email: string | null;
} | null> {
  return getByPhone(phone);
}

/**
 * Get a customer by phone, or create a new one with a default name.
 */


    const findOrCreate = async (phone: string, name: string) => {
    const existing = await getByPhone(phone);
    if (existing) {
      return existing;
    }
    return prisma.customer.create({
      data: { phone, name, consentGiven: true, consentAt: new Date() },
    });
  }

export async function findOrCreateCustomer(
  phone: string,
  profileName?: string,
): Promise<{ id: string; name: string; phone: string }> {
  const existing = await getByPhone(phone);
  if (existing) {
    return existing;
  }
  return findOrCreate(phone, profileName || "Customer");
}

/**
 * Find the latest active (non-cancelled, non-completed) booking for a customer.
 */
/* 

*/
type BookingWithPayment = Prisma.BookingGetPayload<{
  include: {
    payment: true;
  };
}>;
export const findActiveBooking = async (customerId: string): Promise<BookingWithPayment | null> =>{
  return prisma.booking.findFirst({
    where: {
      customerId,
      status: { in: ["PENDING", "APPROVED", "RESCHEDULED"] },
    },
    include: {
      service: {
        select: { id: true, name: true, durationMinutes: true, priceKes: true },
      },
      payment: true,
    },
    orderBy: { appointmentAt: "asc" },
  });
}
