import { Config, createLogger} from "@wannys-nails/packages";
import { _config } from "./config.js";

const logger = createLogger(_config as unknown as Config)

export const log = logger.child({module: "conversation-worker"})