// Draw the front page's background map: postal code areas shaded by the price per m² of
// two-room flats, as on the map page, over the surrounding countries in grey (Natural Earth,
// public domain). Run once with the API running; the SVG is committed.
// Usage: node scripts/build-home-map.mjs [api origin]
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mapshaper from "mapshaper";

const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const COUNTRIES =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_countries.geojson";
// ETRS-TM35FIN metres, centred on Finland; the neighbours run past the edges of wide screens.
const FRAME = "-1850000,6530000,2650000,7850000";
const FINLAND_OPACITY = 0.32;

const origin = process.argv[2] ?? "http://127.0.0.1:8000";
const shapes = path.join("public", "geo", "postal-areas.topo.json");
const output = path.join("public", "home", "finland.svg");

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

const rows = (await (await download(`${origin}/api/map/values?room_type=two_room`)).json()).filter(
  (row) => row.price_per_m2 !== null,
);
const sorted = rows.map((row) => row.price_per_m2).sort((a, b) => a - b);
const cuts = SEQUENTIAL.slice(1).map(
  (_, index) => sorted[Math.floor(((index + 1) / SEQUENTIAL.length) * (sorted.length - 1))],
);
const fill = (value) => SEQUENTIAL[cuts.filter((cut) => value >= cut).length];

const workdir = await mkdtemp(path.join(os.tmpdir(), "home-map-"));
const fills = path.join(workdir, "fills.csv");
const countries = path.join(workdir, "countries.geojson");
await writeFile(fills, ["postal_code,fill", ...rows.map((row) => `${row.postal_code},${fill(row.price_per_m2)}`)].join("\n"));
await writeFile(countries, Buffer.from(await (await download(COUNTRIES)).arrayBuffer()));

await mapshaper.runCommands(
  `-i "${countries}" name=countries -filter "ADM0_A3 != 'FIN' && ADM0_A3 != 'ALD'" ` +
    `-clip bbox=-20,45,100,82 -proj EPSG:3067 -clip bbox=${FRAME} -style fill=#e4e8ec stroke=#f3f5f7 stroke-width=1.5 ` +
    `-i "${shapes}" -join "${fills}" keys=postal_code,postal_code string-fields=postal_code ` +
    `-each "fill = fill || '${SEQUENTIAL[0]}'" -proj EPSG:3067 -simplify 25% keep-shapes ` +
    `-dissolve fill target=postal_areas ` +
    `-rectangle bbox=${FRAME} name=frame -style fill=none ` +
    `-o target=countries,postal_areas,frame format=svg width=2000 precision=0.1 "${output}"`,
);

const svg = await readFile(output, "utf-8");
await writeFile(output, svg.replace('<g id="postal_areas"', `<g id="postal_areas" opacity="${FINLAND_OPACITY}"`));
console.log(`Wrote ${output}`);
