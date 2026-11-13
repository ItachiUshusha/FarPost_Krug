import express, { type ErrorRequestHandler } from "express";
import { MongoNetworkError, MongoServerError, MongoServerSelectionError } from "mongodb";
import { ZodError } from "zod";
import { config } from "./config";
import { database } from "./db/client";
import { definitions } from "./db/collections";
import { ApiError } from "./lib/errors";
import { collectionsRouter } from "./routes/collections";
import { documentsRouter } from "./routes/documents";
import { krugRouter } from "./routes/krug";

export const app = express();
app.disable("x-powered-by");

// This is a local admin tool. No CORS access; writes require JSON + a custom header.
app.use((request, response, next) => {
  const host = request.hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    return next(new ApiError(403, "Клиент базы доступен только локально."));
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    if (
      (request.path.startsWith("/api/krug") ? request.get("x-krug-client") !== "krug" : request.get("x-db-client") !== "vibe-farpost") ||
      (request.method !== "DELETE" && !request.is("application/json"))
    ) {
      return next(
        new ApiError(403, "Изменения доступны через локальный клиент базы."),
      );
    }
    const origin = request.get("origin");
    if (origin) {
      try {
        if (
          !["localhost", "127.0.0.1", "[::1]"].includes(
            new URL(origin).hostname,
          )
        ) {
          return next(new ApiError(403, "Запросы с внешних сайтов запрещены."));
        }
      } catch {
        return next(new ApiError(403, "Некорректный источник запроса."));
      }
    }
  }
  response.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "1mb" }));

app.get("/api/db/health", async (_request, response) => {
  await database.command({ ping: 1 });
  const collections = await definitions
    .find({ name: { $not: /^krug_/ } }, { projection: { name: 1 } })
    .toArray();
  const counts = await Promise.all(
    collections.map(({ name }) => database.collection(name).countDocuments()),
  );
  response.json({
    connected: true,
    database: config.database,
    collections: collections.length,
    documents: counts.reduce((total, count) => total + count, 0),
  });
});

app.use("/api/krug", krugRouter);
app.use("/api/db/collections/:name/documents", documentsRouter);
app.use("/api/db/collections", collectionsRouter);
app.use((_request, _response, next) =>
  next(new ApiError(404, "Маршрут не найден.")),
);

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) return next(error);
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
  } else if (error instanceof ZodError) {
    response
      .status(400)
      .json({ error: error.issues.map((issue) => issue.message).join(" ") });
  } else if (
    error instanceof MongoServerError &&
    [48, 11000].includes(Number(error.code))
  ) {
    response
      .status(409)
      .json({ error: "Коллекция или запись с таким именем уже существует." });
  } else if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Некорректный JSON в запросе." });
  } else if (
    error instanceof Error &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    response.status(413).json({ error: "Размер запроса превышает 1 МБ." });
  } else if (error instanceof MongoNetworkError || error instanceof MongoServerSelectionError) {
    response.status(503).json({ error: "База временно недоступна. Проверьте запуск MongoDB." });
  } else {
    console.error(
      "Database API error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: "Не удалось выполнить действие. Попробуйте ещё раз.",
      });
  }
};
app.use(errorHandler);
