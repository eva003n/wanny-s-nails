
const isDevelopment = (process.env.NODE_ENV || "development") === "development";
const isTest = process.env.NODE_ENV === "test";

if (isDevelopment || isTest) {
  const { config } = await import("dotenv");

  config({ path: `${process.cwd()}/.env`, override: true });

  const envFile = `.env.${process.env.NODE_ENV || "development"}`;
  config({ path: `${process.cwd()}/${envFile}`, override: true });
}




