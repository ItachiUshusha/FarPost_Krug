import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const port = Number(process.env.MONGODB_LOCAL_PORT || 27018);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("MONGODB_LOCAL_PORT должен быть портом от 1024 до 65535.");
}
const dataPath = resolve(".local/mongodb");
await mkdir(dataPath, { recursive: true });
console.log(`MongoDB: 127.0.0.1:${port} | files: ${dataPath}`);

const child = spawn(
  process.env.MONGOD_BINARY || "mongod",
  [
    "--dbpath",
    dataPath,
    "--bind_ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--wiredTigerCacheSizeGB",
    "0.25",
    "--quiet",
    "--logpath",
    resolve(".local/mongodb.log"),
    "--logappend",
  ],
  { stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(
    `Не удалось запустить mongod: ${error.message}. Установите MongoDB Community Server или укажите MONGOD_BINARY.`,
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (code && code !== 0)
    console.error(
      "MongoDB завершилась с ошибкой. Подробности: .local/mongodb.log",
    );
  process.exitCode = signal ? 0 : (code ?? 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
