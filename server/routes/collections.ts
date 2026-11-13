import { Router } from "express";
import { z } from "zod";
import { database } from "../db/client";
import { definitions } from "../db/collections";
import { ApiError } from "../lib/errors";
import { collectionDefinition, collectionName } from "../lib/validation";

export const collectionsRouter = Router();

collectionsRouter.get("/", async (_request, response) => {
  const items = await definitions
    .find({}, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .toArray();
  const collections = await Promise.all(
    items.map(async (item) => ({
      ...item,
      count: await database.collection(item.name).countDocuments(),
    })),
  );
  response.json({ collections });
});

collectionsRouter.post("/", async (request, response) => {
  const definition = collectionDefinition.parse(request.body);
  if (await definitions.findOne({ name: definition.name })) {
    throw new ApiError(409, "Коллекция с таким именем уже существует.");
  }
  // createCollection deliberately fails if a collection exists outside this client.
  const collection = await database.createCollection(definition.name);
  await collection.createIndex({ createdAt: -1, _id: -1 });
  await definitions.insertOne({ ...definition });
  response.status(201).json({ collection: { ...definition, count: 0 } });
});

collectionsRouter.put("/:name", async (request, response) => {
  const name = collectionName.parse(request.params.name);
  const definition = collectionDefinition.parse(request.body);
  if (definition.name !== name)
    throw new ApiError(400, "Системное имя коллекции изменить нельзя.");
  const previous = await definitions.findOne({ name });
  if (!previous) throw new ApiError(404, "Коллекция не найдена.");

  const count = await database.collection(name).countDocuments();
  if (count > 0) {
    for (const field of previous.fields) {
      const next = definition.fields.find(
        (candidate) => candidate.key === field.key,
      );
      if (
        !next ||
        next.type !== field.type ||
        next.required !== field.required
      ) {
        throw new ApiError(
          409,
          "В коллекции с записями можно менять подписи и добавлять необязательные поля. Смена типов и удаление полей требуют миграции.",
        );
      }
    }
    if (
      definition.fields.some(
        (field) =>
          field.required &&
          !previous.fields.some((old) => old.key === field.key),
      )
    ) {
      throw new ApiError(
        409,
        "Новое поле должно быть необязательным, пока в коллекции есть записи.",
      );
    }
  }

  await definitions.updateOne({ name }, { $set: definition });
  response.json({ collection: { ...definition, count } });
});

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
});
