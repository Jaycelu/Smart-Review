import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const rootManifestPath = resolve(repoRoot, "manifest.json");
const pluginManifestPath = resolve(repoRoot, "apps/smart-review-plugin/manifest.json");
const rootVersionsPath = resolve(repoRoot, "versions.json");
const pluginVersionsPath = resolve(repoRoot, "apps/smart-review-plugin/versions.json");
const packagePaths = [
  resolve(repoRoot, "package.json"),
  resolve(repoRoot, "apps/smart-review-plugin/package.json"),
  resolve(repoRoot, "packages/shared/package.json")
];

const rootManifest = readJson(rootManifestPath);
const pluginManifest = readJson(pluginManifestPath);

if (rootManifest.id !== pluginManifest.id) {
  throw new Error(`Plugin id mismatch: root=${rootManifest.id}, plugin=${pluginManifest.id}`);
}

const version = rootManifest.version;
const minAppVersion = rootManifest.minAppVersion;
pluginManifest.version = version;
pluginManifest.minAppVersion = minAppVersion;
writeJson(pluginManifestPath, pluginManifest);

for (const manifestPath of [rootManifestPath, pluginManifestPath]) {
  const manifest = readJson(manifestPath);
  if (!manifest.version || !manifest.minAppVersion) {
    throw new Error(`${manifestPath} must include version and minAppVersion`);
  }
}

for (const packagePath of packagePaths) {
  const packageJson = readJson(packagePath);
  packageJson.version = version;
  writeJson(packagePath, packageJson);
}

for (const versionsPath of [rootVersionsPath, pluginVersionsPath]) {
  const versions = readJson(versionsPath);
  versions[version] = minAppVersion;
  writeJson(versionsPath, sortVersionMap(versions));
}

console.log(`Synced Smart Review release metadata to ${version} (Obsidian >= ${minAppVersion}).`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sortVersionMap(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareSemver(left, right))
  );
}

function compareSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}
