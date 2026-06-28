import {_config} from "./shared/lib/index.js"
import { logger} from "./shared/lib/logger.js";


import {server} from "./app.js"


const port = _config.PORT;


server.listen(port, () => {
    logger.info({ event: "server.started", port, baseUrl: _config.BASE_URL }, `Server running on ${_config.BASE_URL}`)
})

process.on("uncaughtException", (err) => {
    logger.error({
      event: "Error.uncaughtException",
      error:  err.message
    });
})