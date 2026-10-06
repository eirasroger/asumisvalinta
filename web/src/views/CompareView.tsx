import { Suspense } from "react";
import { Planner } from "@/components/planner/Planner";
import { PlannerSkeleton } from "@/components/planner/PlannerSkeleton";

export function CompareView() {
  return (
    <Suspense fallback={<PlannerSkeleton />}>
      <Planner />
    </Suspense>
  );
}
