// Download the dbt documentation of the latest data release into public/data-docs,
// so the site serves it at /data-docs/. Skipped with a warning when the release
// cannot be reached, for example in local builds without network access.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE = "https://github.com/eirasroger/asumisvalinta/releases/latest/download";
const FILES = {
  "index.html": "dbt-docs-index.html",
  "manifest.json": "dbt-docs-manifest.json",
  "catalog.json": "dbt-docs-catalog.json",
};
const target = path.join(process.cwd(), "public", "data-docs");

try {
  await mkdir(target, { recursive: true });
  for (const [name, asset] of Object.entries(FILES)) {
    const response = await fetch(`${RELEASE}/${asset}`);
    if (!response.ok) throw new Error(`${asset}: HTTP ${response.status}`);
    await writeFile(path.join(target, name), Buffer.from(await response.arrayBuffer()));
  }
  console.log("dbt docs downloaded to public/data-docs");
} catch (error) {
  console.warn(`dbt docs not downloaded: ${error.message}`);
}
