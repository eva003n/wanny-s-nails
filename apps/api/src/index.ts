import { createServer } from "http";
import { createApp } from "./app.js";
import { _config } from "./shared/lib/index.js";
import { logger } from "./shared/lib/logger.js";

const app = createApp();
const server = createServer(app);

const port = _config.PORT;

server.listen(port, () => {
  logger.info(
    { event: "server.started", port, baseUrl: _config.BASE_URL },
    `Server running on ${_config.BASE_URL}`,
  );
});

process.on("uncaughtException", (err) => {
  logger.error({
    event: "Error.uncaughtException",
    error: err.message,
  });
});