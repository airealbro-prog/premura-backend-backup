import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; positive: boolean };
  accentColor?: string;
}

export function StatCard({ label, value, icon, trend, accentColor }: StatCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-2 min-w-[180px]">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm font-medium tracking-wide uppercase">
          {label}
        </span>
        {icon && (
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(0, 212, 255, 0.1)" }}
          >
            {icon}
          </span>
        )}
      </div>
      <span
        className="text-3xl font-bold tabular-nums tracking-tight"
        style={{ color: accentColor ?? "#e2e8f0" }}
      >
        {value}
      </span>
      {trend && (
        <span
          className="text-xs font-medium"
          style={{ color: trend.positive ? "#22c55e" : "#ef4444" }}
        >
          {trend.positive ? "+" : ""}{trend.value}% vs last cycle
        </span>
      )}
    </div>
  );
}
