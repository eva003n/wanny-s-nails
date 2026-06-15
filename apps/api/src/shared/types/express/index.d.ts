import { Request, Response } from "express";
import { dbClient } from "../../infra/db/index.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
   
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