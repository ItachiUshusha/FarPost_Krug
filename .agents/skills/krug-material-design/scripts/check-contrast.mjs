import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultPath = fileURLToPath(new URL("../assets/krug-material-tokens.json", import.meta.url));
const source = process.argv[2] ? resolve(process.argv[2]) : defaultPath;

function luminance(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error("Expected a six-digit opaque hex color.");
  }
  const linear = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

try {
  const { colors } = JSON.parse(await readFile(source, "utf8"));
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    throw new Error("Tokens must contain a colors object.");
  }
  const pairs = [
    ["primary", "onPrimary", 4.5],
    ["primaryContainer", "onPrimaryContainer", 4.5],
    ["secondary", "onSecondary", 4.5],
    ["secondaryContainer", "onSecondaryContainer", 4.5],
    ["tertiary", "onTertiary", 4.5],
    ["tertiaryContainer", "onTertiaryContainer", 4.5],
    ["error", "onError", 4.5],
    ["errorContainer", "onErrorContainer", 4.5],
    ["surface", "onSurface", 4.5],
    ["surface", "onSurfaceVariant", 4.5],
    ["surfaceContainerHighest", "onSurfaceVariant", 4.5],
    ["inverseSurface", "inverseOnSurface", 4.5],
    ["surface", "outline", 3],
    ["surface", "primary", 3],
  ];
  let failures = 0;
  for (const [background, foreground, minimum] of pairs) {
    const first = luminance(colors[background]);
    const second = luminance(colors[foreground]);
    const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    const passed = ratio >= minimum;
    if (!passed) failures++;
    process.stdout.write(`${passed ? "PASS" : "FAIL"} ${foreground} / ${background}: ${ratio.toFixed(2)}:1 (minimum ${minimum}:1)\n`);
  }
  process.stdout.write(`${pairs.length - failures}/${pairs.length} color pairs passed. This checks opaque token pairs, not the rendered page.\n`);
  if (failures) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Contrast check failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
}
