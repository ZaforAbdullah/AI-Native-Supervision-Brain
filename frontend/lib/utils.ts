import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskGrade } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function riskGradeColor(grade: RiskGrade | string): string {
  switch (grade) {
    case "critical": return "text-risk-critical";
    case "high": return "text-risk-high";
    case "medium": return "text-risk-medium";
    case "low": return "text-risk-low";
    default: return "text-muted-faint";
  }
}

export function riskGradeBadgeClass(grade: RiskGrade | string): string {
  switch (grade) {
    case "critical": return "bg-risk-critical-bg text-risk-critical border-risk-critical-border";
    case "high": return "bg-risk-high-bg text-risk-high border-risk-high-border";
    case "medium": return "bg-risk-medium-bg text-risk-medium border-risk-medium-border";
    case "low": return "bg-risk-low-bg text-risk-low border-risk-low-border";
    default: return "bg-line-faint text-muted-faint border-line";
  }
}

export function riskGradeBgClass(grade: RiskGrade | string): string {
  switch (grade) {
    case "critical": return "bg-risk-critical";
    case "high": return "bg-risk-high";
    case "medium": return "bg-risk-medium";
    case "low": return "bg-risk-low";
    default: return "bg-muted-faint";
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function riskScoreLabel(score: number): string {
  if (score >= 8) return "Critical";
  if (score >= 5) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

export const GRADE_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const DATASET_LABELS: Record<string, string> = {
  mortgage_lender_spread: "Mortgage Lender Spread",
  protection_provider_spread: "Protection Provider Spread",
  file_review_results: "File Review Results",
  file_review_deficiencies: "File Review Deficiencies",
  enhanced_financial_monitoring: "Enhanced Financial Monitoring",
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
