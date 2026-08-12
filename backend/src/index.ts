import "dotenv/config";
import app from "./app.js";
import config from "./config/app.config.js";
import connectDatabase from "./database/database.js";

app.listen(config.PORT, async () => {
  console.log(`Server is running on port ${config.PORT} in ${config.NODE_ENV}`);

  await connectDatabase();
});
