import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Db, MongoClient } from "mongodb";
import type {
  CollectionDefinition,
  DatabaseStatus,
  DocumentPage,
  DocumentRecord,
} from "../shared/database";

const testDatabase = `vibe_farpost_test_${process.pid}_${Date.now()}`;
process.env.MONGODB_DATABASE = testDatabase;
let server: Server | undefined;
let client: MongoClient;
let database: Db;
let baseUrl: string;
let firstDocument: DocumentRecord;

const definition: CollectionDefinition = {
  name: "records",
  label: "Тестовые записи",
  description: "Изолированная тестовая коллекция",
  fields: [
    { key: "title", label: "Название", type: "text", required: true },
    { key: "amount", label: "Число", type: "number", required: false },
    { key: "active", label: "Активно", type: "boolean", required: true },
    { key: "date", label: "Дата", type: "date", required: false },
    { key: "url", label: "Ссылка", type: "url", required: false },
  ],
};
const validValues = {
  title: "Первая запись",
  amount: 0,
  active: false,
  date: "2026-11-13",
  url: "https://example.com",
};

async function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>,
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-DB-Client": "vibe-farpost",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

before(async () => {
  const { app } = await import("../server/app");
  const connection = await import("../server/db/client");
  client = connection.mongoClient;
  database = connection.database;
  assert.equal(database.databaseName, testDatabase);
  await connection.connectDatabase();
  const { initializeDatabase } = await import("../server/db/collections");
  await initializeDatabase();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/db`;
});

after(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
      server!.closeAllConnections();
    });
  if (database?.databaseName === testDatabase) await database.dropDatabase();
  await client?.close();
});

test("real MongoDB is connected and the new database is empty", async () => {
  const response = await request("/health");
  assert.equal(response.status, 200);
  const status: DatabaseStatus = await response.json();
  assert.equal(status.connected, true);
  assert.equal(status.database, testDatabase);
  assert.equal(status.collections, 0);
});

test("create a collection, persist its form definition and prevent duplicates", async () => {
  const response = await request("/collections", "POST", definition);
  assert.equal(response.status, 201);
  assert.equal((await request("/collections", "POST", definition)).status, 409);
  const stored = await database
    .collection("_collections")
    .findOne({ name: "records" });
  assert.deepEqual(stored?.fields, definition.fields);
  assert.ok(
    (await database.listCollections({ name: "records" }).toArray()).length,
  );
  assert.ok(
    (await database.collection("records").indexes()).some(
      (index) => index.key.createdAt === -1,
    ),
  );
});

test("save a form document with native numbers, booleans and automatic timestamps", async () => {
  const response = await request("/collections/records/documents", "POST", {
    values: validValues,
  });
  assert.equal(response.status, 201);
  firstDocument = (await response.json()).document;
  assert.match(firstDocument.id, /^[a-f\d]{24}$/);
  assert.equal(firstDocument.values.active, false);
  assert.equal(firstDocument.values.amount, 0);
  assert.ok(!Number.isNaN(Date.parse(firstDocument.createdAt)));
  const stored = await database
    .collection("records")
    .findOne({ title: validValues.title });
  assert.equal(stored?.amount, 0);
  assert.equal(stored?.active, false);
  assert.ok(stored?.createdAt instanceof Date);
  assert.equal(stored?.values, undefined);
});

test("reject invalid values and reserved field names before writing to MongoDB", async () => {
  const invalidValues = [
    { ...validValues, title: " " },
    { ...validValues, amount: "123" },
    { ...validValues, active: "true" },
    { ...validValues, date: "2026-02-30" },
    { ...validValues, url: "javascript:alert(1)" },
    { ...validValues, unexpected: 1 },
    { ...validValues, createdAt: "overridden" },
  ];
  for (const values of invalidValues) {
    assert.equal(
      (await request("/collections/records/documents", "POST", { values }))
        .status,
      400,
    );
  }
  assert.equal(await database.collection("records").countDocuments(), 1);
  assert.equal(
    (
      await request("/collections", "POST", {
        ...definition,
        name: "bad",
        fields: [{ key: "_id", label: "ID", type: "text", required: true }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/collections", "POST", {
        ...definition,
        name: "bad",
        fields: [definition.fields[0], definition.fields[0]],
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/collections/records/documents?page=-1")).status,
    400,
  );
  assert.equal(
    (await request("/collections/records/documents/invalid", "DELETE")).status,
    400,
  );
});

test("block writes from external origins or without the client header", async () => {
  assert.equal(
    (
      await request(
        "/collections/records/documents",
        "POST",
        { values: validValues },
        { Origin: "https://external.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${baseUrl}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(definition),
      })
    ).status,
    403,
  );
});

test("edit a document, clear optional fields, and preserve identity and creation time", async () => {
  const response = await request(
    `/collections/records/documents/${firstDocument.id}`,
    "PUT",
    {
      values: {
        title: "Обновлённая запись",
        active: true,
        amount: null,
        date: null,
        url: null,
      },
    },
  );
  assert.equal(response.status, 200);
  const updated: DocumentRecord = (await response.json()).document;
  assert.equal(updated.id, firstDocument.id);
  assert.equal(updated.createdAt, firstDocument.createdAt);
  assert.equal(updated.values.title, "Обновлённая запись");
  assert.equal(updated.values.amount, null);
});

test("add form fields without losing existing data; require migrations for destructive schema changes", async () => {
  const fields = [
    ...definition.fields,
    {
      key: "note",
      label: "Комментарий",
      type: "textarea" as const,
      required: false,
    },
  ];
  assert.equal(
    (await request("/collections/records", "PUT", { ...definition, fields }))
      .status,
    200,
  );
  assert.equal(
    (
      await request("/collections/records", "PUT", {
        ...definition,
        fields: fields.slice(1),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/collections/records", "PUT", {
        ...definition,
        fields: fields.map((field) =>
          field.key === "note" ? { ...field, required: true } : field,
        ),
      })
    ).status,
    409,
  );
  const response = await request("/collections/records/documents");
  const records: DocumentPage = await response.json();
  assert.equal(records.items[0].values.note, null);
  assert.equal(records.items[0].values.title, "Обновлённая запись");
});

test("paginate documents and report database totals", async () => {
  for (let index = 0; index < 16; index++) {
    assert.equal(
      (
        await request("/collections/records/documents", "POST", {
          values: { ...validValues, title: `Запись ${index}` },
        })
      ).status,
      201,
    );
  }
  const first: DocumentPage = await (
    await request("/collections/records/documents?page=1&pageSize=15")
  ).json();
  const second: DocumentPage = await (
    await request("/collections/records/documents?page=2&pageSize=15")
  ).json();
  assert.equal(first.total, 17);
  assert.equal(first.items.length, 15);
  assert.equal(second.items.length, 2);
  assert.ok(
    second.items.every(
      (item) => !first.items.some((other) => other.id === item.id),
    ),
  );
  const status: DatabaseStatus = await (await request("/health")).json();
  assert.equal(status.documents, 17);
  assert.equal(status.collections, 1);
});

test("delete a single document and leave the collection intact", async () => {
  assert.equal(
    (
      await request(
        `/collections/records/documents/${firstDocument.id}`,
        "DELETE",
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await request(
        `/collections/records/documents/${firstDocument.id}`,
        "DELETE",
      )
    ).status,
    404,
  );
  assert.equal(await database.collection("records").countDocuments(), 16);
  assert.equal((await request("/collections/missing/documents")).status, 404);
});
