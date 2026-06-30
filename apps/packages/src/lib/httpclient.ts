import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type { Logger } from "pino";

export interface HttpClientConfig {
  serviceName: string; // for logging/metrics tagging — e.g. "mpesa", "whatsapp"
  baseURL: string;
  timeoutMs: number;
  maxRetries?: number; // default 0 — opt in per service
  retryableStatusCodes?: number[]; // default [429, 502, 503, 504]
  getAuthHeader?: () => Promise<Record<string, string>>; // async because tokens may need refresh
  defaultHeaders?: Record<string, string>;
}

// Augment Axios config to carry our own retry bookkeeping through the chain
declare module "axios" {
  export interface AxiosRequestConfig {
    __retryCount?: number;
  }
}

export function createHttpClient(
  config: HttpClientConfig,
  logger: Logger,
): AxiosInstance {
  const {
    serviceName,
    baseURL,
    timeoutMs,
    maxRetries = 0,
    retryableStatusCodes = [429, 502, 503, 504],
    getAuthHeader,
    defaultHeaders = {},
  } = config;

  const instance = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      "Content-Type": "application/json",
      ...defaultHeaders,
    },
  });

  // --- Request interceptor: inject auth, attach request-scoped logging context ---
  instance.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
    if (getAuthHeader) {
      const authHeaders = await getAuthHeader();
      Object.assign(req.headers, authHeaders);
    }

    logger.debug(
      {
        service: serviceName,
        method: req.method,
        url: req.url,
        body: req.data,
      },
      "outbound request",
    );

    return req;
  });

  // --- Response interceptor: normalize errors, handle retries ---
  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const cfg = error.config;
      if (!cfg) return Promise.reject(error);

      const status = error.response?.status;
      const isRetryable =
        !error.response || // network error / timeout, no response at all
        (status !== undefined && retryableStatusCodes.includes(status));

      cfg.__retryCount = cfg.__retryCount ?? 0;

      if (isRetryable && cfg.__retryCount < maxRetries) {
        cfg.__retryCount += 1;
        const backoffMs = 2 ** cfg.__retryCount * 250; // 500ms, 1s, 2s...
        logger.warn(
          {
            service: serviceName,
            attempt: cfg.__retryCount,
            status,
            url: cfg.url,
          },
          "retrying request after failure",
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        return instance(cfg);
      }

      logger.error(
        { service: serviceName, status, url: cfg.url, message: error.message },
        "request failed, no more retries",
      );

      // Normalize so callers don't need to know about AxiosError shape
      return Promise.reject(
        new HttpClientError(
          serviceName,
          status,
          error.message,
          error.response?.data,
        ),
      );
    },
  );

  return instance;
}

export class HttpClientError extends Error {
  constructor(
    public readonly service: string,
    public readonly status: number | undefined,
    message: string,
    public readonly responseBody?: unknown,
  ) {
    let { stackTraceLimit } = Error;
    const limit = stackTraceLimit;
    stackTraceLimit = 0;

    super(`[${service}] ${message}`);
    stackTraceLimit = limit;
    this.name = "HttpClientError";

    if(!this.stack) {
      Error.captureStackTrace(this, HttpClientError)
    }
  }
}
