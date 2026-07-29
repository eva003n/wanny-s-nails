import { Request, Response } from "express";
import { dbClient } from "../../infra/db/index.js";
import type { JwtPayload } from "jsonwebtoken";
import type { WebhookEvent } from "../../../modules/webhooks/schemas.ts";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user: {userId: string , role: "OWNER" | "STAFF", email: string};
   
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
      whatsappEvents: WebhookEvent[]
      // [key: string]: string
    }
    interface Response {
      jsonApi<T>(status: number, data: T): this;
    }
  }
}