import pino from "pino";
import { config } from "./config.js";

const isProduction = config.NODE_ENV === "production";

// Build transport targets
type TransportTarget = {
  target: string;
  level?: string;
  options?: Record<string, unknown>;
};

const targets: TransportTarget[] = [];

// Console — always on
targets.push(
  isProduction
    ? {
        // Production: raw JSON to stdout (machine-readable)
        target: "pino/file",
        options: { destination: 1 }, // fd 1 = stdout
      }
    : {
        // Dev: pretty-printed, colorized
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "yyyy-mm-dd hh:MM:ss.l TT", // 2026-05-05 04:30:22.966 PM
          ignore: "pid,hostname",
          messageFormat: "{msg}",
        },
      },
);

// Production-only transports
if (isProduction) {
  // All logs — rotating file (replaces winston-daily-rotate-file)
  targets.push({
    target: "pino-roll",
    options: {
      file: `logs/app.log`,
      frequency: "daily", // rotate daily
      size: "20m", // also rotate at 20MB
      limit: { count: 14 }, // keep 14 files  ≈ maxFiles: "14d"
      compress: "gzip", // zippedArchive: true
      mkdir: true,
    },
  });

  // Error-only — separate rotating file
  targets.push({
    target: "pino-roll",
    level: "error",
    options: {
      file: `logs/app.log`,
      frequency: "daily",
      size: "20m",
      limit: { count: 30 }, // keep 30 files  ≈ maxFiles: "30d"
      compress: "gzip",
      mkdir: true,
    },
  });

  // Logtail / Better Stack
  targets.push({
    target: "@logtail/pino",
    options: {
      sourceToken: config.LOGTAIL_SOURCE_TOKEN ,
      options: {
        endpoint: config.LOGTAIL_INGESTION_HOST as string,
      },
    },
  });
}

// Create logger

const logger = pino(
  {
    level: config.LOG_LEVEL || "info",

    // Pino uses numeric levels; map to npm-style names
    // trace=10 debug=20 info=30 warn=40 error=50 fatal=60
    // (Pino's defaults already match Winston's npm levels in spirit)

    // Serialize Error objects correctly (replaces winston errors({ stack: true }))
    serializers: {
      err: pino.stdSerializers.err, // captures message + stack
      error: pino.stdSerializers.err, // alias — works whichever key you use
    },

    // Redact sensitive fields before any transport sees them
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
      ],
      censor: "[REDACTED]",
    },

    // Static fields added to every log line
    base: { service: config.APP_NAME, env: config.NODE_ENV },

    // ISO-ish timestamp format
    // timestamp: pino.stdTimeFunctions.unixTime,
    timestamp: () => {
      const now = new Date();
      const formatted = now
        .toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
          hour12: true,
        })
        .replace(",", ""); // "05/07/2026 04:30:22.966 PM"

      return `,"time":"${formatted}"`;
    },
  },
  pino.transport({ targets }),
);

export {logger};
