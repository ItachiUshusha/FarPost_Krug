import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

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
  "--replSet", "krug-rs", "--oplogSize", "128",
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

async function initializeReplicaSet() {
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 1_000 });
  try {
    let connected = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null) throw new Error("MongoDB stopped before initialization.");
      try { await client.connect(); await client.db("admin").command({ ping: 1 }); connected = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    if (!connected) throw new Error("MongoDB не ответила при запуске.");
    try { await client.db("admin").command({ replSetGetStatus: 1 }); }
    catch (error) {
      if (error.code !== 94) throw error;
      await client.db("admin").command({ replSetInitiate: { _id: "krug-rs", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const hello = await client.db("admin").command({ hello: 1 });
      if (hello.isWritablePrimary) { console.log("MongoDB replica set krug-rs: PRIMARY ready"); return; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Replica set не выбрал PRIMARY.");
  } finally { await client.close(); }
}
initializeReplicaSet().catch((error) => {
  console.error("Ошибка replica set:", error.message);
  child.kill("SIGTERM");
  process.exitCode = 1;
});
