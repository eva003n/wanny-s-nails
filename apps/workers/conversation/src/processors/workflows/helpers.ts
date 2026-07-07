import { prisma } from "../../lib/prisma.js";

import type { Prisma } from "@wannys-nails/packages";
import type { DateOption, Slot } from "./types.js";
import { getAvailableSlots as sharedGetAvailableSlots } from "@wannys-nails/packages";

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
    return cleaned.slice(1);
  }

  // Local format: 0712345678 or 012345678
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`;
  }

  // Without leading +254 or 0: 254712345678
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `${cleaned}`;
  }

  return null;
}

/**
 * Validate that a phone number is a valid Kenyan number.
 */
export function isValidKenyanPhone(input: string): boolean {
  return parsePhoneToE164(input) !== null;
}

/**
 * Build the next 7 business days (skip closed days) as DateOptions
 * with slot counts for a given service.
 */
// Converts a Date to a YYYY-MM-DD string in EAT, consistently.
// Using this everywhere (instead of mixing shifted/unshifted values)
// avoids the today-vs-candidateDate mismatch from the previous version.
function toEATDateString(date: Date): string {
  const shifted = new Date(date.getTime() + EAT_OFFSET_MS);
  return shifted.toISOString().split("T")[0]!;
}

export async function buildDateOptions(
  serviceId: string,
): Promise<DateOption[]> {
  const options: DateOption[] = [];
  const today = new Date();
  const todayDateStr = toEATDateString(today);

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
      const slotData = await sharedGetAvailableSlots(prisma, dateStr, serviceId);
      const availableCount = slotData.availableSlots;
      const isFull = availableCount === 0;

      // Consistent EAT comparison (kept for future-proofing: if the loop's
      // start date ever changes to include "today", this will correctly
      // flag it instead of silently always evaluating false)
      const isToday = dateStr === todayDateStr;

      options.push({
        label: formatDateShortEAT(candidateDate, isToday),
        date: dateStr,
        availableSlots: availableCount,
        isFull,
      });
    } catch (err) {
      // Log instead of silently swallowing — a real failure here
      // (DB blip, bad serviceId, bug in slot logic) should be visible,
      // not just show up as "fewer date options" to the customer.
      console.error(
        `[buildDateOptions] failed to get slots for ${dateStr}, service ${serviceId}:`,
        err,
      );
    }

    dayOffset++;
  }

  return options;
}

/**
 * Look up a customer by phone without creating a record.
 * Returns null if no customer found.
 */
export const getByPhone = async (phone: string) => {
  return prisma.customer.findUnique({ where: { phone } });
};
export async function findCustomerByPhone(phone: string): Promise<{
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
};

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
    service: {
      select: { id: true; name: true; durationMinutes: true; priceKes: true };
    };
    payment: true;
  };
}>;
export const findActiveBooking = async (
  customerId: string,
): Promise<BookingWithPayment | null> => {
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
    orderBy: { appointmentAt: "asc" }, // oldest -> most recent
  });
};