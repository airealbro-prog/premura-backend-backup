import { getAchievementColor } from "../../lib/calculations";

interface AchievementBadgeProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
}

export function AchievementBadge({ percentage, size = "md" }: AchievementBadgeProps) {
  const color = getAchievementColor(percentage);
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tabular-nums ${sizeClasses[size]}`}
      style={{
        color,
        background: `${color}20`,
        border: `1px solid ${color}40`,
      }}
    >
      {percentage.toFixed(1)}%
    </span>
  );
}
