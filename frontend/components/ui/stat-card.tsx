import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleClassName?: string;
  valueClassName?: string;
  className?: string;
}

export function StatCard({
  title, value, subtitle, subtitleClassName, valueClassName, className,
}: StatCardProps) {
  return (
    <div className={cn("card p-4", className)}>
      <p className="text-[10.5px] font-semibold text-muted-label uppercase tracking-wider">{title}</p>
      <p className={cn("mt-1.5 text-[28px] font-bold font-mono text-ink-navy leading-none", valueClassName)}>{value}</p>
      {subtitle && <p className={cn("mt-1.5 text-[11.5px] text-muted", subtitleClassName)}>{subtitle}</p>}
    </div>
  );
}
