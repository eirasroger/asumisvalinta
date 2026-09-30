// Build a simplified TopoJSON map of Finnish postal code areas from Statistics Finland's
// Paavo WFS service (licence CC BY 4.0). Usage: node scripts/build-postal-map.mjs <output>
import { writeFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mapshaper from "mapshaper";

const WFS =
  "https://geo.stat.fi/geoserver/postialue/wfs?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=postialue:pno_2026&outputFormat=application/json&srsName=EPSG:4326" +
  "&propertyName=posti_alue,kunta,geom";

const output = process.argv[2] ?? path.join("public", "geo", "postal-areas.topo.json");
const response = await fetch(WFS);
if (!response.ok) throw new Error(`Paavo WFS: HTTP ${response.status}`);

const workdir = await mkdtemp(path.join(os.tmpdir(), "postal-map-"));
const input = path.join(workdir, "postal-areas.json");
await writeFile(input, Buffer.from(await response.arrayBuffer()));

await mapshaper.runCommands(
  `-i "${input}" -rename-fields postal_code=posti_alue,municipality_code=kunta ` +
    `-filter-fields postal_code,municipality_code -rename-layers postal_areas ` +
    `-simplify 3% keep-shapes -o format=topojson quantization=100000 "${output}"`,
);
console.log(`Wrote ${output}`);
