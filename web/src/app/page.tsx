import { Suspense } from "react";
import { Explore } from "@/components/map/Explore";

export default function ExplorePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}
