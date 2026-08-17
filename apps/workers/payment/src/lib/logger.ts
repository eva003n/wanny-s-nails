import { Config, createLogger} from "@wannys-nails/core";
import { _config } from "./config.js";

const logger = createLogger(_config as unknown as Config)

export const log = logger.child({module: "payment-worker"})