import axios, { AxiosError, AxiosResponse } from "axios";
import { _config as config } from "./config.js";
import { log } from "./logger.js";
import { createHttpClient, HttpClientError } from "@wannys-nails/packages";
import { redis } from "./redis.js";

import { z } from "zod";

const authResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.coerce.number(),
});

type AuthResponse = z.infer<typeof authResponseSchema>;

const MPESA_ACCESS_TOKEN_KEY = "mpesa:access_token";
const TOKEN_TTL_BUFFER_SECONDS = 60; // refresh before actual expiry

async function getAccessToken() {
  const clientCredentials = Buffer.from(
    `${config.DARAJA_CONSUMER_KEY}:${config.DARAJA_CONSUMER_SECRET}`,
  ).toString("base64");

  try {
    // avoid requesting a token on every request
    const existingToken = await redis.get(MPESA_ACCESS_TOKEN_KEY);

    if (existingToken) return existingToken;

    const response = await axios.get<{}, AxiosResponse<AuthResponse>, {}>(
      `${config.DARAJA_BASE_URL}/oauth/v1/generate`,
      {
        headers: {
          Authorization: `Basic ${clientCredentials}`,
        },
        params: {
          grant_type: "client_credentials",
        },
      },
    );

    const { data } = authResponseSchema.safeParse(response.data);

    const token = data?.access_token;
    const expiresIn = data?.expires_in;

    // save token in redis for 1 hour

    const expirySec = Number(expiresIn) - TOKEN_TTL_BUFFER_SECONDS; // prevent serving stale token
    await redis.setex(MPESA_ACCESS_TOKEN_KEY, expirySec, token as string);

    return token;
  } catch (error) {
    const err = error as unknown as {
      response: {
        status: number,
        data: Record<string, unknown>
      }
    }
    if(err instanceof AxiosError) {
       log.error(
         {
           event: "mpesa.authorization.failed",
           status: err.status,
           data: err.response.data || err.request,
           error: err.message,
         },
         "Mpesa access token generation failed",
       );

    }
  }
}

export const mpesaHttpClient = createHttpClient(
  {
    serviceName: "mpesa",
    baseURL: config.DARAJA_BASE_URL,
    timeoutMs: 120_000,
    maxRetries: 1, // BullMQ already retries the whole job — don't double up on retries here
    getAuthHeader: async () => ({
      Authorization: `Bearer ${await getAccessToken()}`,
    }),
    defaultHeaders: {
      "Content-Type": "application/json",
    },
  },
  log,
);
