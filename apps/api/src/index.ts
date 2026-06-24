import {config} from "./shared/lib/config.js"
import {server} from "./app.js"
import { logger } from "@wannys-nails/packages";

const port = config.PORT;


server.listen(port, () => {
    logger.info({ event: "server.started", port, baseUrl: config.BASE_URL }, `Server running on ${config.BASE_URL}`)
})

process.on("uncaughtException", (err) => {
    logger.error(err, err.message)
})