import { getAvailableSlots, getRecommendedSlots } from "@wannys-nails/packages";
import type { TimePeriod } from "@wannys-nails/packages";
import { prisma } from "../../shared/lib/index.js";

import { BusinessClosedError } from "../../shared/types/errors.js";

export const slotsService = {
  async getAvailableSlots(
    date: string,
    serviceIds: string,
  ) {
    try {
      return await getAvailableSlots(prisma, date, serviceIds);
    } catch (error) {
      if (error instanceof Error && error.message === "The salon is closed on the requested date") {
        throw new BusinessClosedError();
      }
      throw error;
    }
  },

  async getRecommendedSlots(
    date: string,
    serviceId: string,
    timePeriod: TimePeriod,
  ) {
    try {
      const availability = await getAvailableSlots(prisma, date, serviceId);
      const recommended = getRecommendedSlots({
        slots: availability.slots.filter((s) => s.available),
        timePeriod,
        maxResults: 10,
      });
      return {
        ...availability,
        recommendedSlots: recommended.slots,
        timePeriod: recommended.timePeriod,
        totalInPeriod: recommended.totalInPeriod,
        truncated: recommended.truncated,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "The salon is closed on the requested date") {
        throw new BusinessClosedError();
      }
      throw error;
    }
  },
};
