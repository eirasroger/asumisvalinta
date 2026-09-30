// Download build inputs from the latest data release: the dbt documentation (served at
// /data-docs/) and the postal code area map. Skipped with a warning when the release
// cannot be reached, for example in local builds without network access.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE = "https://github.com/eirasroger/asumisvalinta/releases/latest/download";
const FILES = [
  ["dbt-docs-index.html", "data-docs/index.html"],
  ["dbt-docs-manifest.json", "data-docs/manifest.json"],
  ["dbt-docs-catalog.json", "data-docs/catalog.json"],
  ["postal-areas.topo.json", "geo/postal-areas.topo.json"],
];

for (const [asset, target] of FILES) {
  const destination = path.join(process.cwd(), "public", target);
  try {
    const response = await fetch(`${RELEASE}/${asset}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${asset}`);
  } catch (error) {
    console.warn(`Could not download ${asset}: ${error.message}`);
  }
}
