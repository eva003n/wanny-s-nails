import { NotFoundError } from "../types/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response, NextFunction } from "express";


export const notFound = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
   return next(new NotFoundError("Resource"))
})