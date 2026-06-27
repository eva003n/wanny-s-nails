import {config} from "./shared/lib/config.js"
import {server} from "./app.js"
import { logger } from "@wannys-nails/packages";

export const log = logger.child({module: "api"})

const port = config.PORT;


server.listen(port, () => {
    log.info({ event: "server.started", port, baseUrl: config.BASE_URL }, `Server running on ${config.BASE_URL}`)
})

process.on("uncaughtException", (err) => {
    log.error(err, err.message)
})