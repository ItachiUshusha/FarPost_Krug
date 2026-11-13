import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import { demoGraph } from "../server/domain/krug/demo";
import { findCircles } from "../server/domain/krug/graph";
async function main() {
  const runs = [];
  for (const size of [12, 120, 250]) {
    const fixture = demoGraph();
    const input = Array.from({ length: size }, (_, i) => {
      const base = fixture[i % 12], group = Math.floor(i / 12);
      return { ...base, id: `listing-${i}`, ownerId: `owner-${i}`, title: `${base.title} · набор${group}х`, description: `${base.description} набор${group}х`, requiredKeywords: [`набор${group}х`] };
    });
    const result = findCircles(input, undefined, { limit: 10_000, timeLimitMs: 1000 });
    runs.push({ size, cycles: result.total, elapsedMs: result.elapsedMs, examined: result.examined, truncated: result.truncated });
  }
  const result = { node: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0].model, limits: { maxNodes: 250, maxParticipants: 4, maxExpansions: 100000, timeLimitMs: 1000 }, runs };
  await mkdir(".local/qa", { recursive: true }); await writeFile(".local/qa/benchmark.json", JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
}
void main();
