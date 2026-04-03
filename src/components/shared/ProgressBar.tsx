import { getAchievementColor } from "@/lib/calculations";

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  height?: number;
}

export function ProgressBar({ percentage, showLabel = true, height = 8 }: ProgressBarProps) {
  const color = getAchievementColor(percentage);
  const clampedWidth = Math.min(percentage, 100);

  return (
    <div className="flex items-center gap-3 w-full">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: `${height}px`, background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full progress-animate"
          style={{
            width: `${clampedWidth}%`,
            background:
              percentage > 100
                ? "linear-gradient(90deg, #7b2ff7, #00d4ff)"
                : `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        />
      </div>
      {showLabel && (
        <span
          className="text-sm font-semibold tabular-nums min-w-[52px] text-right"
          style={{ color }}
        >
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
