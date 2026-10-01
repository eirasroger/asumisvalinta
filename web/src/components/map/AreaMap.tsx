"use client";

import type { FeatureCollection, Geometry, Position } from "geojson";
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type LngLatBoundsLike,
  Map as MapLibre,
  type MapLayerMouseEvent,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapValue } from "@/lib/api";
import {
  isEstimated,
  loadShapes,
  type MapMetric,
  type MapScope,
  metricValue,
  SCOPES,
  SEQUENTIAL,
  type Shape,
} from "@/lib/mapData";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const SOURCE = "areas";

function bounds(geometry: Geometry): LngLatBoundsLike {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (positions: unknown) => {
    if (typeof (positions as Position)[0] === "number") {
      const [x, y] = positions as Position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    } else (positions as unknown[]).forEach(visit);
  };
  if ("coordinates" in geometry) visit(geometry.coordinates);
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function hatchImage() {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if ((x + y) % size === 0) data.set([255, 255, 255, 110], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

export interface HoverInfo {
  postal_code: string;
  name: string;
  value: number | null;
  estimated: boolean;
  x: number;
  y: number;
}

interface Props {
  rows: MapValue[] | null;
  metric: MapMetric;
  cuts: number[];
  scope: MapScope;
  selected: string | null;
  onSelect: (postalCode: string) => void;
  onHover: (info: HoverInfo | null) => void;
  onReady?: () => void;
  padding?: Padding;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function inset(extra: Padding | undefined, base: number) {
  return {
    top: base + (extra?.top ?? 0),
    right: base + (extra?.right ?? 0),
    bottom: base + (extra?.bottom ?? 0),
    left: base + (extra?.left ?? 0),
  };
}

const SETTLE_LIMIT_MS = 1500;

export function AreaMap({ rows, metric, cuts, scope, selected, onSelect, onHover, onReady, padding }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const [all, setAll] = useState<Shape[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handlers = useRef({ onSelect, onHover, onReady });
  useEffect(() => {
    handlers.current = { onSelect, onHover, onReady };
  }, [onSelect, onHover, onReady]);
  const announced = useRef(false);
  const initialScope = useRef(scope);
  const initialPadding = useRef(padding);
  const paddingRef = useRef(padding);
  useEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  useEffect(() => {
    loadShapes().then(setAll, (caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const instance = new MapLibre({
      container: container.current,
      style: STYLE,
      bounds: SCOPES.find((item) => item.value === initialScope.current)!.bounds,
      fitBoundsOptions: { padding: inset(initialPadding.current, 24) },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 4,
      maxZoom: 15,
    });
    instance.touchZoomRotate.disableRotation();
    instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    instance.on("load", () => {
      const firstSymbol = instance.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      instance.addImage("hatch", hatchImage());
      instance.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "postal_code" });
      instance.addLayer({ id: "areas-fill", type: "fill", source: SOURCE, paint: { "fill-color": "#e2e7ec", "fill-opacity": 0.78 } }, firstSymbol);
      instance.addLayer(
        { id: "areas-hatch", type: "fill", source: SOURCE, filter: ["==", ["get", "estimated"], true], paint: { "fill-pattern": "hatch" } },
        firstSymbol,
      );
      instance.addLayer(
        { id: "areas-line", type: "line", source: SOURCE, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.2, 10, 0.8] } },
        firstSymbol,
      );
      instance.addLayer({
        id: "areas-hover",
        type: "line",
        source: SOURCE,
        paint: { "line-color": "#1a2530", "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0] },
      });
      instance.addLayer({
        id: "areas-selected",
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "postal_code"], ""],
        paint: { "line-color": "#1a2530", "line-width": 2.5 },
      });
      setReady(true);
    });

    let hovered: string | null = null;
    const clearHover = () => {
      if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
      hovered = null;
      instance.getCanvas().style.cursor = "";
      handlers.current.onHover(null);
    };
    instance.on("mousemove", "areas-fill", (event: MapLayerMouseEvent) => {
      const hit = event.features?.[0];
      if (!hit) return;
      const code = hit.properties.postal_code as string;
      if (hovered !== code) {
        if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
        instance.setFeatureState({ source: SOURCE, id: code }, { hover: true });
        hovered = code;
      }
      instance.getCanvas().style.cursor = "pointer";
      const value = hit.properties.value;
      handlers.current.onHover({
        postal_code: code,
        name: hit.properties.name as string,
        value: typeof value === "number" ? value : null,
        estimated: hit.properties.estimated === true,
        x: event.point.x,
        y: event.point.y,
      });
    });
    instance.on("mouseleave", "areas-fill", clearHover);
    instance.on("click", "areas-fill", (event: MapLayerMouseEvent) => {
      const code = event.features?.[0]?.properties.postal_code;
      if (typeof code === "string") handlers.current.onSelect(code);
    });

    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  const collection = useMemo<FeatureCollection | null>(() => {
    if (!all) return null;
    const byCode = new Map((rows ?? []).map((row) => [row.postal_code, row]));
    return {
      type: "FeatureCollection",
      features: all.map((shape) => {
        const row = byCode.get(shape.properties.postal_code);
        return {
          type: "Feature",
          geometry: shape.geometry,
          properties: {
            postal_code: shape.properties.postal_code,
            name: row?.postal_area_name ?? "",
            value: row ? metricValue(row, metric) : null,
            estimated: row ? isEstimated(row, metric) && metricValue(row, metric) !== null : false,
          },
        };
      }),
    };
  }, [all, rows, metric]);

  useEffect(() => {
    if (!ready || !collection) return;
    const instance = map.current;
    (instance?.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection);
    if (!instance || !rows || announced.current) return;
    announced.current = true;
    // Reveal once the coloured areas are drawn, or after a short wait on slow connections.
    const reveal = () => {
      clearTimeout(timer);
      instance.off("idle", reveal);
      handlers.current.onReady?.();
    };
    const timer = setTimeout(reveal, SETTLE_LIMIT_MS);
    instance.once("idle", reveal);
  }, [ready, collection, rows]);

  useEffect(() => {
    if (!ready || cuts.length === 0) return;
    const steps: (string | number)[] = [SEQUENTIAL[0]];
    cuts.forEach((cut, index) => steps.push(cut, SEQUENTIAL[index + 1]));
    const color = [
      "case",
      ["==", ["typeof", ["get", "value"]], "number"],
      ["step", ["get", "value"], ...steps],
      "#dfe3e8",
    ] as unknown as ExpressionSpecification;
    map.current?.setPaintProperty("areas-fill", "fill-color", color);
  }, [ready, cuts]);

  useEffect(() => {
    if (!ready) return;
    map.current?.setFilter("areas-selected", ["==", ["get", "postal_code"], selected ?? ""]);
  }, [ready, selected]);

  useEffect(() => {
    if (!ready || !selected || !all) return;
    const shape = all.find((item) => item.properties.postal_code === selected);
    const instance = map.current;
    if (!shape || !instance) return;
    const target = bounds(shape.geometry);
    const view = instance.getBounds();
    const [[minX, minY], [maxX, maxY]] = target as [[number, number], [number, number]];
    if (!view.contains([minX, minY]) || !view.contains([maxX, maxY])) {
      instance.fitBounds(target, { padding: inset(paddingRef.current, 48), maxZoom: 12, duration: 900 });
    }
  }, [ready, selected, all]);

  const firstScope = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstScope.current) {
      firstScope.current = false;
      return;
    }
    map.current?.fitBounds(SCOPES.find((item) => item.value === scope)!.bounds, {
      padding: inset(paddingRef.current, 24),
      duration: 1200,
    });
  }, [ready, scope]);

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      {error && (
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 rounded-lg bg-paper px-4 py-3 text-sm shadow-float">{error}</p>
      )}
    </div>
  );
}
