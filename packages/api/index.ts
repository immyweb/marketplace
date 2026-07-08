import { app } from "./src/app.js";
import { logger } from "./src/shared/logger.js";

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  logger.info(`API running on http://localhost:${PORT}`);
});
