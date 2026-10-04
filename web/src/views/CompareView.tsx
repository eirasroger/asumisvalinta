import { Suspense } from "react";
import { Planner } from "@/components/planner/Planner";

export function CompareView() {
  return (
    <Suspense>
      <Planner />
    </Suspense>
  );
}
