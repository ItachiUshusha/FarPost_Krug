import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";
import { MongoClient, ObjectId } from "mongodb";
import { demoInput, demoPeople } from "../server/domain/krug/demo";
import type { Candidate, Circle, Listing, SearchResult, User } from "../shared/krug/types";

const databaseName = `krug_test_${process.pid}_${Date.now()}`;
process.env.MONGODB_DATABASE = databaseName;
process.env.DEMO_MODE = "true";
process.env.NODE_ENV = "test";
let database: Db; let client: MongoClient; let server: Server; let base: string;
type Actor = { user: User; cookie: string };
async function call(path: string, method = "GET", body?: unknown, actor?: Actor) {
  const response = await fetch(`${base}/api/krug${path}`, { method,
    headers: { "Content-Type": "application/json", "X-Krug-Client": "krug", ...(actor ? { Cookie: actor.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}
async function demo(key: string): Promise<Actor> {
  const result = await call("/demo/session", "POST", { key }); assert.equal(result.response.status, 200);
  return { user: result.data.user, cookie: result.response.headers.get("set-cookie")!.split(";")[0] };
}
async function guest(name: string): Promise<Actor> {
  const result = await call("/session/guest", "POST", { name, areaId: "center" }); assert.equal(result.response.status, 201);
  return { user: result.data.user, cookie: result.response.headers.get("set-cookie")!.split(";")[0] };
}
async function listing(actor: Actor, index: number): Promise<Listing> {
  const result = await call("/listings", "POST", demoInput(demoPeople[index]), actor);
  assert.equal(result.response.status, 201, JSON.stringify(result.data)); return result.data.listing;
}
async function create(candidate: Candidate, actor: Actor): Promise<Circle> {
  const result = await call("/circles", "POST", { listingIds: candidate.listingIds, versions: candidate.versions }, actor);
  assert.equal(result.response.status, 201, JSON.stringify(result.data)); return result.data.circle;
}
before(async () => {
  const connection = await import("../server/db/client"); client = connection.mongoClient; database = connection.database;
  assert.equal(database.databaseName, databaseName); await connection.connectDatabase();
  await (await import("../server/db/collections")).initializeDatabase();
  await (await import("../server/repositories/krug")).initializeKrug();
  await (await import("../server/services/krug")).seedDemo();
  const { app } = await import("../server/app");
  await new Promise<void>((resolve, reject) => { server = app.listen(0, "127.0.0.1", resolve); server.on("error", reject); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  if (server) await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
  if (database?.databaseName === databaseName) await database.dropDatabase();
  await client?.close();
});
let anna: Actor; let root: Listing; let original: Circle;
test("demo seed is idempotent; session uses HttpOnly cookie and stored hash", async () => {
  await (await import("../server/services/krug")).seedDemo();
  assert.equal(await database.collection("krug_users").countDocuments(), 12);
  assert.equal(await database.collection("krug_listings").countDocuments(), 11);
  anna = await demo("A");
  assert.equal((await call("/session", "GET", undefined, anna)).data.user.name, "Анна");
  const session = await database.collection("krug_sessions").findOne({ userId: new ObjectId(anna.user.id) });
  assert.notEqual(session?.tokenHash, anna.cookie.split("=")[1]);
  assert.equal((await call("/listings", "POST", demoInput(demoPeople[0]))).response.status, 401);
});
test("create through API, match correct orientation and preserve stored fields", async () => {
  root = await listing(anna, 0);
  const found = await call("/matches", "POST", { listingId: root.id }, anna);
  assert.equal(found.response.status, 200);
  const result: SearchResult = found.data;
  assert.equal(result.total, 2); assert.equal(result.truncated, false);
  assert.ok(result.candidates.every((candidate) => candidate.members.length === 3));
  assert.equal(result.candidates[0].members[0].receiveTypeId, "bicycle");
  assert.equal(result.candidates[0].members[0].giveTypeId, "monitor");
  original = await create(result.candidates.find((candidate) => candidate.members.some((member) => member.name === "Борис"))!, anna);
  assert.equal((await create(result.candidates.find((candidate) => candidate.members.some((member) => member.name === "Борис"))!, anna)).id, original.id);
  assert.ok((await database.collection("krug_listings").findOne({ _id: new ObjectId(root.id) }))?.createdAt instanceof Date);
});
test("ownership, private circles, schema and studio bypass protection", async () => {
  const stranger = await guest("Гость");
  assert.equal((await call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, stranger)).response.status, 403);
  assert.equal((await call(`/circles/${original.id}`, "GET", undefined, stranger)).response.status, 404);
  assert.equal((await call(`/listings/${root.id}`, "PATCH", { values: demoInput(demoPeople[0]), version: 1 }, stranger)).response.status, 403);
  assert.equal((await call("/listings", "POST", { ...demoInput(demoPeople[0]), ownerId: stranger.user.id }, anna)).response.status, 400);
  const response = await fetch(`${base}/api/db/collections/krug_listings/documents`, { headers: { "X-DB-Client": "vibe-farpost" } });
  assert.equal(response.status, 403);
});
test("decline closes versioned circle and search offers a different triple", async () => {
  await call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, anna);
  const boris = await demo("B");
  const result = await call(`/circles/${original.id}/respond`, "POST", { decision: "decline" }, boris);
  assert.equal(result.data.circle.status, "declined");
  const found: SearchResult = (await call("/matches", "POST", { listingId: root.id }, anna)).data;
  assert.equal(found.total, 1);
  assert.ok(found.candidates[0].members.some((member) => member.name === "Даша"));
  const comparison = (await call("/metrics")).data;
  assert.equal(comparison.directOwners, 2);
  assert.equal(comparison.multiwayOwners, 9);
  original = await create(found.candidates[0], anna);
});
test("all participants agree atomically; repeated response and cancellation are safe", async () => {
  const dasha = await demo("E"); const gleb = await demo("D");
  assert.equal((await call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, anna)).data.circle.status, "proposed");
  const results = await Promise.all([call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, dasha), call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, gleb)]);
  assert.ok(results.every((result) => result.response.status === 200));
  assert.equal((await call(`/circles/${original.id}`, "GET", undefined, anna)).data.circle.status, "agreed");
  assert.equal(await database.collection("krug_listings").countDocuments({ reservedBy: new ObjectId(original.id) }), 3);
  assert.equal((await call(`/circles/${original.id}/respond`, "POST", { decision: "accept" }, anna)).response.status, 200);
  assert.equal((await call(`/listings/${root.id}`, "PATCH", { values: demoInput(demoPeople[0]), version: 1 }, anna)).response.status, 409);
  assert.equal((await call(`/circles/${original.id}/cancel`, "POST", {}, anna)).data.circle.status, "cancelled");
  assert.equal(await database.collection("krug_listings").countDocuments({ reservedBy: new ObjectId(original.id) }), 0);
});
test("competing final confirmations cannot both reserve the same item", async () => {
  const actors = await Promise.all(["Альфа", "Бета", "Гамма", "Дельта", "Эпсилон"].map(guest));
  const offered: Listing[] = [];
  for (let i = 0; i < actors.length; i++) offered.push(await listing(actors[i], i));
  const { makeCandidate } = await import("../server/domain/krug/graph");
  const first = await create(makeCandidate([offered[0], offered[2], offered[1]])!, actors[0]);
  const second = await create(makeCandidate([offered[0], offered[4], offered[3]])!, actors[0]);
  for (const index of [2, 1]) await call(`/circles/${first.id}/respond`, "POST", { decision: "accept" }, actors[index]);
  for (const index of [4, 3]) await call(`/circles/${second.id}/respond`, "POST", { decision: "accept" }, actors[index]);
  const results = await Promise.all([call(`/circles/${first.id}/respond`, "POST", { decision: "accept" }, actors[0]), call(`/circles/${second.id}/respond`, "POST", { decision: "accept" }, actors[0])]);
  assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409]);
  assert.equal(await database.collection("krug_circles").countDocuments({ _id: { $in: [new ObjectId(first.id), new ObjectId(second.id)] }, status: "agreed" }), 1);
});
test("changing content invalidates old suggestions and rejects stale updates", async () => {
  const a = await guest("Редактор"); const b = await guest("Сосед");
  const one = await listing(a, 9); const two = await listing(b, 10);
  const { makeCandidate } = await import("../server/domain/krug/graph");
  const circle = await create(makeCandidate([one, two])!, a);
  assert.equal((await call(`/listings/${one.id}`, "PATCH", { values: { ...demoInput(demoPeople[9]), title: "Изменённый чайник" }, version: 1 }, a)).response.status, 200);
  assert.equal((await call(`/circles/${circle.id}`, "GET", undefined, a)).data.circle.status, "invalidated");
  assert.equal((await call(`/listings/${one.id}`, "PATCH", { values: demoInput(demoPeople[9]), version: 1 }, a)).response.status, 409);
  assert.equal((await call(`/listings/${one.id}/archive`, "POST", { version: 2 }, a)).data.listing.status, "archived");
});
test("expiration releases reservations and explicit session expiry is enforced", async () => {
  const active = await database.collection("krug_circles").findOne({ status: "agreed" });
  assert.ok(active);
  await database.collection("krug_circles").updateOne({ _id: active._id }, { $set: { expiresAt: new Date(0) } });
  await call("/metrics");
  assert.equal((await database.collection("krug_circles").findOne({ _id: active._id }))?.status, "expired");
  assert.equal(await database.collection("krug_listings").countDocuments({ reservedBy: active._id }), 0);
  await database.collection("krug_sessions").updateMany({ userId: new ObjectId(anna.user.id) }, { $set: { expiresAt: new Date(0) } });
  assert.equal((await call("/session", "GET", undefined, anna)).data.user, null);
});
test("malformed input, Mongo-style operators and cross-origin writes are rejected", async () => {
  const validator = await guest("Проверка ввода");
  assert.equal((await call("/listings/not-an-id")).response.status, 400);
  assert.equal((await call("/matches", "POST", { listingId: { $ne: null } }, validator)).response.status, 400);
  assert.equal((await call("/matches", "POST", { listingId: "a".repeat(24), limit: 1000 }, validator)).response.status, 400);
  const malformed = await fetch(`${base}/api/krug/session/guest`, { method: "POST", headers: { "Content-Type": "application/json", "X-Krug-Client": "krug" }, body: "{bad json" });
  assert.equal(malformed.status, 400);
  const large = await fetch(`${base}/api/krug/session/guest`, { method: "POST", headers: { "Content-Type": "application/json", "X-Krug-Client": "krug" }, body: JSON.stringify({ name: "x".repeat(1_100_000) }) });
  assert.equal(large.status, 413);
  const external = await fetch(`${base}/api/krug/session/guest`, { method: "POST", headers: { "Content-Type": "application/json", "X-Krug-Client": "krug", Origin: "https://unrelated.example" }, body: JSON.stringify({ name: "Гость", areaId: "center" }) });
  assert.equal(external.status, 403);
});
test("new connection reads persisted data; demo reset preserves unrelated data", async () => {
  const real = await guest("Настоящий профиль"); const item = await listing(real, 9);
  const fresh = new MongoClient(process.env.MONGODB_URI!);
  try {
    await fresh.connect();
    const saved = await fresh.db(databaseName).collection("krug_listings").findOne({ _id: new ObjectId(item.id) });
    assert.equal(saved?.title, item.title); assert.ok(saved?.createdAt instanceof Date);
  } finally { await fresh.close(); }
  await database.collection("unrelated_test_records").insertOne({ preserved: true });
  await (await import("../server/services/krug")).seedDemo(true);
  assert.ok(await database.collection("krug_listings").findOne({ _id: new ObjectId(item.id) }));
  assert.equal(await database.collection("unrelated_test_records").countDocuments({ preserved: true }), 1);
  assert.equal(await database.collection("krug_listings").countDocuments({ datasetId: "krug-demo-v1" }), 11);
  // Put the selected listing exactly at the truncation boundary: it must still
  // be the root, while irrelevant recent items are omitted from this search.
  const stored = database.collection("krug_listings");
  await stored.updateMany({ _id: { $ne: new ObjectId(item.id) } }, { $set: { status: "archived" } });
  await stored.updateOne({ _id: new ObjectId(item.id) }, { $set: { createdAt: new Date(0) } });
  const template = (await stored.findOne({ _id: new ObjectId(item.id) }))!;
  await stored.insertMany(Array.from({ length: 249 }, () => ({ ...template, _id: new ObjectId(), createdAt: new Date(), itemTypeId: "helmet", categoryId: "outdoors", title: "Тестовый шлем", wantText: "Швейная машина", wantedTypeIds: ["sewing_machine"] })));
  const partner = await guest("Партнёр по проверке"); await listing(partner, 10);
  const result: SearchResult = (await call("/matches", "POST", { listingId: item.id }, real)).data;
  assert.equal(result.inputCount, 250); assert.equal(result.truncated, true); assert.equal(result.total, 1);
  const event = { type: "candidate_view", signature: result.candidates[0].signature };
  assert.equal((await call("/events", "POST", event, real)).response.status, 204);
  assert.equal((await call("/events", "POST", event, real)).response.status, 204);
  assert.equal(await database.collection("krug_events").countDocuments({ type: "candidate_view", userId: new ObjectId(real.user.id) }), 1);
});
