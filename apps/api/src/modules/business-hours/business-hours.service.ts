
import { prisma } from "../../shared/lib/index.js";

interface HoursInput {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const businessHoursService = {
  async list() {
    return prisma.businessHours.findMany({
      orderBy: { dayOfWeek: "asc" },
    });
  },

  async upsertMany(entries: HoursInput[]) {
    const operations = entries.map((entry) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: entry.dayOfWeek },
        update: {
          openTime: entry.openTime,
          closeTime: entry.closeTime,
          isActive: entry.isActive,
        },
        create: {
          dayOfWeek: entry.dayOfWeek,
          openTime: entry.openTime,
          closeTime: entry.closeTime,
          isActive: entry.isActive,
        },
      }),
    );

    return prisma.$transaction(operations);
  },

  /** Seed default hours if none exist */
  async seedDefaults() {
    const count = await prisma.businessHours.count();
    if (count > 0) return;

    const defaults: HoursInput[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      openTime: i === 0 ? "09:00" : "08:00", // Sunday opens at 9, others at 8
      closeTime: i === 0 ? "17:00" : "19:00", // Sunday closes at 5, others at 7
      isActive: i !== 0, // Sunday closed by default
    }));

    await prisma.$transaction(
      defaults.map((d) =>
        prisma.businessHours.create({ data: d }),
      ),
    );
  },
};

export { DAY_NAMES };