import type { Request, Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service.js";
import { success } from "../../shared/utils/response.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { logger } from "../../shared/lib/index.js";


const log = logger.child({ module: "dashboard.controller" });

export const getStats = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    log.debug(
      { event: "dashboard.stats.requested" },
      "Fetching dashboard stats",
    );
    const stats = await dashboardService.getStats();
    success(res, stats, undefined, {type: "no-cache", maxAgeSec: 15});
  },
);
