import { Router } from "express";
import { ObjectId, type Document } from "mongodb";
import type { DocumentRecord } from "../../shared/database";
import { database } from "../db/client";
import { definitions } from "../db/collections";
import { ApiError } from "../lib/errors";
import {
  collectionName,
  documentBody,
  validateValues,
} from "../lib/validation";
import { pagination } from "./collections";
import { ensureStudioCollection } from "../lib/studio-access";

export const documentsRouter = Router({ mergeParams: true });

documentsRouter.param("id", (_request, _response, next, value: string) => {
  if (!/^[a-f\d]{24}$/i.test(value))
    return next(new ApiError(400, "Некорректный идентификатор записи."));
  next();
});

function serialize(document: Document, fields: string[]): DocumentRecord {
  return {
    id: document._id.toHexString(),
    values: Object.fromEntries(
      fields.map((key) => [key, document[key] ?? null]),
    ),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

documentsRouter.use(async (request, response, next) => {
  const name = collectionName.parse(request.params.name);
  ensureStudioCollection(name);
  const definition = await definitions.findOne({ name });
  if (!definition) throw new ApiError(404, "Коллекция не найдена.");
  response.locals.definition = definition;
  next();
});

documentsRouter.get("/", async (request, response) => {
  const { page, pageSize } = pagination.parse(request.query);
  const definition = response.locals.definition;
  const collection = database.collection(definition.name);
  const [documents, total] = await Promise.all([
    collection
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(),
  ]);
  response.json({
    items: documents.map((document) =>
      serialize(
        document,
        definition.fields.map((field: { key: string }) => field.key),
      ),
    ),
    total,
    page,
    pageSize,
  });
});

documentsRouter.post("/", async (request, response) => {
  const definition = response.locals.definition;
  const { values } = documentBody.parse(request.body);
  const data = validateValues(definition, values);
  const now = new Date();
  const document = {
    _id: new ObjectId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await database.collection(definition.name).insertOne(document);
  response.status(201).json({
    document: serialize(
      document,
      definition.fields.map((field: { key: string }) => field.key),
    ),
  });
});

documentsRouter.put("/:id", async (request, response) => {
  const definition = response.locals.definition;
  const { values } = documentBody.parse(request.body);
  const data = validateValues(definition, values);
  const document = await database
    .collection(definition.name)
    .findOneAndUpdate(
      { _id: new ObjectId(request.params.id as string) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  if (!document) throw new ApiError(404, "Запись не найдена.");
  response.json({
    document: serialize(
      document,
      definition.fields.map((field: { key: string }) => field.key),
    ),
  });
});

documentsRouter.delete("/:id", async (request, response) => {
  const result = await database
    .collection(response.locals.definition.name)
    .deleteOne({ _id: new ObjectId(request.params.id as string) });
  if (!result.deletedCount) throw new ApiError(404, "Запись не найдена.");
  response.status(204).end();
});
