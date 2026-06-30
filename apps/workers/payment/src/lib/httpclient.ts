import axios, { AxiosResponse } from "axios";
import { _config as config } from "./config.js";
import { log } from "./logger.js";
import { createHttpClient } from "@wannys-nails/packages";
import { redis } from "./redis.js";


import {z} from "zod"



const authResponseSchema = z.object({
 access_token: z.string(),
  expires_in: z.coerce.number()
})

type  AuthResponse = z.infer<typeof authResponseSchema>

const MPESA_ACCESS_TOKEN_KEY="mpesa:access_token"
const TOKEN_TTL_BUFFER_SECONDS = 60; // refresh before actual expiry

async function getAccessToken() {

    const clientCredentials = Buffer.from(
      `${config.DARAJA_CONSUMER_KEY}:${config.DARAJA_CONSUMER_SECRET}`,
    ).toString("base64");


    // avoid requesting a token on every request
    const existingToken = await redis.get(MPESA_ACCESS_TOKEN_KEY)

    if(existingToken) return existingToken;

    const response = axios.get<{}, AxiosResponse< AuthResponse>, {}>(`${config.DARAJA_BASE_URL}/oauth/v1/generate`, {
        headers: {
           Authorization: `Basic ${clientCredentials}`
        }, 
        params: {
         grant_type:"client_credentials"
        }
    })

    const {data} = authResponseSchema.safeParse(response)

    const token = data?.access_token
    const expiresIn = data?.expires_in

    // save token in redis for 1 hour

    const expirySec = Number(expiresIn) - TOKEN_TTL_BUFFER_SECONDS// prevent serving stale token
    await redis.setex(MPESA_ACCESS_TOKEN_KEY, expirySec, token as string )
    
    return token

    
}

export const mpesaHttpClient = createHttpClient
({
  serviceName: "mpesa",
  baseURL: config.DARAJA_BASE_URL,
  timeoutMs: 30_000,
  maxRetries: 1, // BullMQ already retries the whole job — don't double up on retries here
  getAuthHeader: async() => ({
    Authorization: `Bearer ${await getAccessToken()}`
  }),
  defaultHeaders: {
    "Content-Type": "application/json",
  },
}, log)