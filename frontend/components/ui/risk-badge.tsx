import { cn, riskGradeBadgeClass } from "@/lib/utils";
import type { RiskGrade } from "@/lib/api";

const LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function RiskBadge({ grade, className }: { grade: RiskGrade | string; className?: string }) {
  return (
    <span className={cn("badge", riskGradeBadgeClass(grade), className)}>
      {LABELS[grade] || grade}
    </span>
  );
}
