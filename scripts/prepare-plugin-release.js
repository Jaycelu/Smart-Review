import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const pluginDir = resolve(repoRoot, "apps/smart-review-plugin");
const outputDir = resolve(repoRoot, "dist/plugin");
const releaseAssets = ["main.js", "manifest.json", "styles.css"];

const rootManifest = readJson(resolve(repoRoot, "manifest.json"));
const pluginManifest = readJson(resolve(pluginDir, "manifest.json"));
const rootVersions = readJson(resolve(repoRoot, "versions.json"));
const pluginVersions = readJson(resolve(pluginDir, "versions.json"));

assertEqual(pluginManifest.id, rootManifest.id, "root and plugin manifest id");
assertEqual(pluginManifest.version, rootManifest.version, "root and plugin manifest version");
assertEqual(pluginManifest.minAppVersion, rootManifest.minAppVersion, "root and plugin minAppVersion");
assertEqual(rootVersions[rootManifest.version], rootManifest.minAppVersion, "root versions.json entry");
assertEqual(pluginVersions[rootManifest.version], rootManifest.minAppVersion, "plugin versions.json entry");

rmSync(outputDir, { force: true, recursive: true });
mkdirSync(outputDir, { recursive: true });

for (const asset of releaseAssets) {
  const source = resolve(pluginDir, asset);
  statSync(source);
  copyFileSync(source, resolve(outputDir, asset));
}

const assetList = releaseAssets.map((asset) => `dist/plugin/${asset}`).join(", ");
console.log(`Prepared Smart Review ${rootManifest.version} release assets: ${assetList}`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}
