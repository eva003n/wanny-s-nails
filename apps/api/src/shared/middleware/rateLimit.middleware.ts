import rateLimit from "express-rate-limit";

/**
 * Global rate limiter: 300 requests per 15 minutes per IP.
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before retrying.",
      details: { retryAfterSeconds: 60 },
    },
  },
});

/**
 * Login rate limiter: 10 requests per 15 minutes per IP.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before retrying.",
      details: { retryAfterSeconds: 60 },
    },
  },
});

/**
 * Refresh rate limiter: 20 requests per 15 minutes.
 */
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before retrying.",
      details: { retryAfterSeconds: 60 },
    },
  },
});

/**
 * STK Push rate limiter: 5 requests per 5 minutes per booking.
 */
export const stkPushRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: true,
  // keyGenerator: (req) => {
  //   // return `${req.ip}-${req.body.bookingId}`;
  //   return `${req.body.bookingId}`;
  // },
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before retrying.",
      details: { retryAfterSeconds: 60 },
    },
  },
});

/**
 * WhatsApp webhook rate limiter: 500 requests per minute.
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before retrying.",
      details: { retryAfterSeconds: 60 },
    },
  },
});