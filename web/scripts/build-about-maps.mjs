// Draw the About page's maps from the local map data: Finland as a grid of dots and the Helsinki
// area as postal code areas, both shaded by the price per m² of two-room flats. Run once after
// scripts/export_map_data.py has written public/map; the SVGs are committed.
// Usage: node scripts/build-about-maps.mjs
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mapshaper from "mapshaper";

// Dark background: low prices recede, high prices light up.
const DOTS = ["#243a52", "#28507c", "#2c66a6", "#3580d6", "#5a9be6", "#86b6ef", "#b4d2f7"];
const NO_PRICE = "#1f3044";
const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const HELSINKI_METRO = ["091", "049", "092", "235"];
// Dot spacing in metres (ETRS-TM35FIN) and dot radius as a share of it.
const SPACING = 8500;
const RADIUS = 0.34;

const shapes = path.join("public", "geo", "postal-areas.topo.json");
const values = path.join("public", "map", "values-two_room.json");
const outDir = path.join("public", "about");

const rows = JSON.parse(await readFile(values, "utf-8")).filter((row) => row.price_per_m2 !== null);
/** Seven price classes with equal numbers of areas, as on the map page. */
function classes(subset) {
  const sorted = subset.map((row) => row.price_per_m2).sort((a, b) => a - b);
  const cuts = [1, 2, 3, 4, 5, 6].map((step) => sorted[Math.floor((step / 7) * (sorted.length - 1))]);
  return (value) => cuts.filter((cut) => value >= cut).length;
}
const bucket = classes(rows);
const price = new Map(rows.map((row) => [row.postal_code, row.price_per_m2]));

const workdir = await mkdtemp(path.join(os.tmpdir(), "about-maps-"));
const projected = path.join(workdir, "areas.json");
await mapshaper.runCommands(`-i "${shapes}" -proj EPSG:3067 -o format=geojson "${projected}"`);
const features = JSON.parse(await readFile(projected, "utf-8")).features.map((feature) => {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const points = polygons.flat(2);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    code: feature.properties.postal_code,
    polygons,
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
});

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const areaAt = (x, y) =>
  features.find(
    (f) =>
      x >= f.box[0] && x <= f.box[2] && y >= f.box[1] && y <= f.box[3] &&
      f.polygons.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((hole) => inRing(x, y, hole))),
  );

const minX = Math.min(...features.map((f) => f.box[0]));
const minY = Math.min(...features.map((f) => f.box[1]));
const maxX = Math.max(...features.map((f) => f.box[2]));
const maxY = Math.max(...features.map((f) => f.box[3]));
const rowHeight = SPACING * (Math.sqrt(3) / 2);
const groups = new Map();
for (let row = 0, y = maxY - rowHeight / 2; y > minY; row++, y -= rowHeight) {
  for (let x = minX + (row % 2 ? SPACING : SPACING / 2); x < maxX; x += SPACING) {
    const area = areaAt(x, y);
    if (!area) continue;
    const value = price.get(area.code);
    const fill = value === undefined ? NO_PRICE : DOTS[bucket(value)];
    const km = (n) => Math.round(n / 100) / 10;
    if (!groups.has(fill)) groups.set(fill, []);
    groups.get(fill).push(`<circle cx="${km(x - minX)}" cy="${km(maxY - y)}" r="${km(SPACING * RADIUS)}"/>`);
  }
}
const width = Math.ceil((maxX - minX) / 1000);
const height = Math.ceil((maxY - minY) / 1000);
const dots = [NO_PRICE, ...DOTS].filter((fill) => groups.has(fill)).map((fill) => `<g fill="${fill}">${groups.get(fill).join("")}</g>`);
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "finland-dots.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${dots.join("")}</svg>\n`,
);

const fills = path.join(workdir, "fills.csv");
const metroBucket = classes(rows.filter((row) => HELSINKI_METRO.includes(row.municipality_code)));
const fill = (value) => SEQUENTIAL[metroBucket(value)];
await writeFile(fills, ["postal_code,fill", ...rows.map((row) => `${row.postal_code},${fill(row.price_per_m2)}`)].join("\n"));
await mapshaper.runCommands(
  `-i "${shapes}" -filter "[${HELSINKI_METRO.map((code) => `'${code}'`).join(",")}].includes(municipality_code)" ` +
    `-join "${fills}" keys=postal_code,postal_code string-fields=postal_code ` +
    `-each "fill = fill || '${SEQUENTIAL[0]}'" -proj EPSG:3067 -simplify 40% keep-shapes ` +
    `-style stroke=#ffffff stroke-width=0.6 ` +
    `-o format=svg width=1200 precision=0.1 "${path.join(outDir, "helsinki.svg")}"`,
);

console.log(`Wrote ${outDir}/finland-dots.svg (${[...groups.values()].flat().length} dots) and ${outDir}/helsinki.svg`);
