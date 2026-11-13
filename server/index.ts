import { app } from "./app";
import { config } from "./config";
import { connectDatabase, mongoClient } from "./db/client";
import { initializeDatabase } from "./db/collections";
import { initializeKrug } from "./repositories/krug";
import { seedDemo } from "./services/krug";

async function start() {
  // MongoDB and the API may be launched by the same command.
  for (let attempt = 0; ; attempt++) {
    try {
      await connectDatabase();
      await initializeDatabase();
      await initializeKrug();
      if (config.demoMode) await seedDemo();
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
      console.log("Ожидание MongoDB…");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  const server = app.listen(config.port, "127.0.0.1", () => {
    console.log(
      `Database API: http://127.0.0.1:${config.port} | database: ${config.database}`,
    );
  });
  server.on("error", (error) => {
    console.error("Не удалось запустить API:", error.message);
    void mongoClient.close().finally(() => process.exit(1));
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => process.exit(1), 5_000);
    timer.unref();
    server.close(() => {
      void mongoClient.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

start().catch(async (error: unknown) => {
  console.error(
    "Не удалось подключить MongoDB:",
    error instanceof Error ? error.message : "Unknown error",
  );
  await mongoClient.close();
  process.exit(1);
});
