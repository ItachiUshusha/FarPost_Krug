import assert from "node:assert/strict";
import { test } from "node:test";
import { demoGraph } from "../server/domain/krug/demo";
import { findCircles, makeCandidate, signature } from "../server/domain/krug/graph";
import { commonConditions, detectTypes, matchOffer, normalize } from "../server/domain/krug/matching";

test("negation stays inside its clause; explicit category and expired availability are respected", () => {
  assert.deepEqual(detectTypes("не велосипед, хочу монитор"), { positive: ["monitor"], negative: ["bicycle"] });
  const [offer, target] = demoGraph();
  target.wantedTypeIds = []; target.wantedCategoryIds = ["electronics"]; target.wantText = "Подойдёт электроника";
  assert.ok(matchOffer(offer, target));
  target.wantedCategoryIds = ["tools"]; assert.equal(matchOffer(offer, target), null);
  offer.availability = [{ start: new Date(Date.now() - 7200000).toISOString(), end: new Date(Date.now() - 3600000).toISOString() }];
  assert.equal(commonConditions([offer, target]), null);
});

test("demo graph produces exactly two triples, one quadruple and one pair", () => {
  const input = demoGraph();
  const result = findCircles(input, undefined, { limit: 100 });
  assert.equal(result.truncated, false);
  assert.equal(result.total, 4);
  assert.deepEqual(result.candidates.map((candidate) => candidate.members.map((member) => input.find((item) => item.id === member.listingId)!.demoKey).join("")).sort(), ["ACB", "AED", "FIHG", "JK"]);
  const root = findCircles(input, input[0].id);
  assert.equal(root.total, 2);
  assert.ok(root.candidates.every((candidate) => candidate.members.length === 3));
  assert.equal(root.candidates[0].members[0].receiveTypeId, "bicycle");
  assert.equal(root.candidates[0].members[0].giveToId, input[2].ownerId);
});
test("rotation deduplicates without identifying reverse orientation", () => {
  const [a, b, c] = demoGraph();
  assert.equal(signature([a, c, b]), signature([c, b, a]));
  assert.notEqual(signature([a, c, b]), signature([a, b, c]));
  assert.equal(makeCandidate([a, b, c]), null);
  assert.equal(makeCandidate([a, a]), null);
});
test("same owner, open path, self loop and length five are excluded", () => {
  const graph = demoGraph();
  assert.equal(findCircles(graph, graph[11].id).total, 0);
  assert.equal(findCircles(graph.slice(0, 2)).total, 0);
  assert.equal(makeCandidate([graph[0], graph[2], { ...graph[1], ownerId: graph[0].ownerId }]), null);
  assert.equal(makeCandidate(graph.slice(0, 5)), null);
});
test("versioned rejected circle is excluded, alternative remains", () => {
  const graph = demoGraph();
  const rejected = signature([graph[0], graph[2], graph[1]]);
  const result = findCircles(graph, graph[0].id, { excluded: new Set([rejected]) });
  assert.equal(result.total, 1);
  assert.ok(result.candidates[0].listingIds.includes(graph[4].id));
  graph[0].version++;
  assert.equal(findCircles(graph, graph[0].id, { excluded: new Set([rejected]) }).total, 2);
});
test("Russian aliases and negations preserve explicit exclusions", () => {
  assert.equal(normalize(" Ёлка, ДРЕЛЬ! "), "елка дрель");
  assert.deepEqual(detectTypes("Хочу велик, не дрель"), { positive: ["bicycle"], negative: ["drill"] });
  const [a, b] = demoGraph();
  assert.ok(matchOffer(b, { ...a, wantText: "Нужен велик", wantedTypeIds: [] }));
  assert.equal(matchOffer(b, { ...a, wantText: "Не нужен велосипед", wantedTypeIds: [] }), null);
  assert.equal(matchOffer(b, { ...a, excludedKeywords: ["городской"] }), null);
  assert.equal(matchOffer(b, { ...a, requiredKeywords: ["горный"] }), null);
  assert.equal(matchOffer({ ...b, condition: "repair" }, { ...a, minimumCondition: "good" }), null);
});
test("whole-circle areas, length and time are required", () => {
  const [a, b, c] = demoGraph();
  assert.equal(makeCandidate([{ ...a, maxParticipants: 2 }, c, b]), null);
  assert.equal(makeCandidate([{ ...a, meetingAreaIds: ["center"] }, { ...c, meetingAreaIds: ["churkin"] }, b]), null);
  const window = (day: number) => { const start = Date.now() + day * 86_400_000; return { start: new Date(start).toISOString(), end: new Date(start + 7_200_000).toISOString() }; };
  assert.equal(commonConditions([{ ...a, availability: [window(1), window(2)] }, { ...b, availability: [window(2), window(3)] }, { ...c, availability: [window(1), window(3)] }]), null);
  assert.ok(commonConditions([{ ...a, availability: [window(1)] }, b, c]));
  assert.equal(commonConditions([{ ...a, pickupOnly: true, areaId: "russky" }, { ...b, meetingAreaIds: ["center"] }]), null);
});
test("inactive listings and explicit search limits are respected", () => {
  const graph = demoGraph();
  graph[0].status = "reserved";
  assert.equal(findCircles(graph, graph[0].id).total, 0);
  assert.equal(findCircles(graph, undefined, { maxExpansions: 1 }).truncated, true);
  assert.equal(findCircles(graph, undefined, { maxNodes: 2 }).truncated, true);
});
