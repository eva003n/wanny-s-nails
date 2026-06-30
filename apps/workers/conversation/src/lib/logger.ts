import { _config } from "./config.js";
import { Config, createLogger } from "@wannys-nails/packages";

const logger = createLogger(_config as unknown as Config);

export const log = logger.child({ module: "conversation-worker" });
