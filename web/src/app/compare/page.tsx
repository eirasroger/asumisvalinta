import { Suspense } from "react";
import { Planner } from "@/components/planner/Planner";

export const metadata = { title: "Compare · Asumisvalinta" };

export default function ComparePage() {
  return (
    <Suspense>
      <Planner />
    </Suspense>
  );
}
