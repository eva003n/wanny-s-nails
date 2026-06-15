import { Request, Response } from "express";
import { dbClient } from "../../infra/db/index.js";
import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: JwtPayload;
   
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
      // [key: string]: string
    }
    interface Response {
      jsonApi<T>(status: number, data: T): this;
    }
  }
}