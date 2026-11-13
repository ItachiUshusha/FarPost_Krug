import { config } from "../config";
import { connectDatabase, mongoClient } from "../db/client";
import { initializeDatabase } from "../db/collections";
import { initializeKrug } from "../repositories/krug";

async function initialize() {
  try {
    await connectDatabase();
    await initializeDatabase();
    await initializeKrug();
    console.log(
      `База ${config.database} готова. Системная коллекция _collections и индексы созданы.`,
    );
  } finally {
    await mongoClient.close();
  }
}

initialize().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Ошибка инициализации базы.",
  );
  process.exit(1);
});
