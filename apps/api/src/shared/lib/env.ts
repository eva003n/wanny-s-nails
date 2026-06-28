
const isDevelopment = (process.env.NODE_ENV || "development") === "development";

if (isDevelopment) {
  const { config } = await import("dotenv");

  config({ path: `${process.cwd()}/.env` });

  const envFile = `.env.${process.env.NODE_ENV || "development"}`;
  config({ path: `${process.cwd()}/${envFile}`});

  console.log(`${process.cwd()}/${envFile}`);

}




