import { getAvailableSlots } from "@wannys-nails/packages";
import { prisma } from "../../shared/lib/index.js";

import { BusinessClosedError } from "../../shared/types/errors.js";

export const slotsService = {
  async getAvailableSlots(
    date: string,
    serviceId: string,
  ) {
    try {
      return await getAvailableSlots(prisma, date, serviceId);
    } catch (error) {
      if (error instanceof Error && error.message === "The salon is closed on the requested date") {
        throw new BusinessClosedError();
      }
      throw error;
    }
  },
};
