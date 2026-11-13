import { connectDatabase, mongoClient } from "../db/client";
import { initializeKrug } from "../repositories/krug";
import { seedDemo } from "../services/krug";

async function main() {
  try {
    await connectDatabase(); await initializeKrug();
    await seedDemo(process.argv.includes("--reset"));
    console.log("Демонабор «Круг»: 12 профилей и 11 заявок готовы. Заявку Анны добавьте через интерфейс.");
  } finally { await mongoClient.close(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Ошибка демонабора"); process.exitCode = 1; });
