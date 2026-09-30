// Serve the MapLibre worker and its shared chunk from public/, where setWorkerUrl points.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.join("node_modules", "maplibre-gl", "dist");
const target = path.join("public", "maplibre");
await mkdir(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(path.join(source, file), path.join(target, file));
}
