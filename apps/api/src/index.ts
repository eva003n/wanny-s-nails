import {config} from "./shared/lib/config.js"
import {server} from "./app.js"
import { logger } from "./shared/lib/logger.js";

const port = config.PORT;

server.listen(port, () => {
    logger.info(`Server running on ${config.BASE_URL}`)
})