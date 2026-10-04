import { Suspense } from "react";
import { preconnect, preload } from "react-dom";
import { Explore } from "@/components/map/Explore";

export function ExploreView() {
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  preload("https://tiles.openfreemap.org/styles/positron", { as: "fetch", crossOrigin: "anonymous" });
  preload("/geo/postal-areas.topo.json", { as: "fetch", crossOrigin: "anonymous" });
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}
