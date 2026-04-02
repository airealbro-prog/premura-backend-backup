import { AchievementBadge } from "./AchievementBadge";
import type { LeaderboardEntry } from "../../types";

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  isTopThree: boolean;
  showCompany?: boolean;
}

function getRankStyle(rank: number) {
  switch (rank) {
    case 1:
      return {
        gradient: "linear-gradient(135deg, #FFD700, #FFA500)",
        label: "1st",
        shadow: "0 0 20px rgba(255, 215, 0, 0.3)",
      };
    case 2:
      return {
        gradient: "linear-gradient(135deg, #C0C0C0, #A0A0A0)",
        label: "2nd",
        shadow: "0 0 20px rgba(192, 192, 192, 0.3)",
      };
    case 3:
      return {
        gradient: "linear-gradient(135deg, #CD7F32, #A0522D)",
        label: "3rd",
        shadow: "0 0 20px rgba(205, 127, 50, 0.3)",
      };
    default:
      return {
        gradient: "linear-gradient(135deg, #16213e, #0f3460)",
        label: `${rank}th`,
        shadow: "none",
      };
  }
}

export function LeaderboardCard({ entry, isTopThree, showCompany }: LeaderboardCardProps) {
  const rankStyle = getRankStyle(entry.rank);

  return (
    <div
      className={`card p-4 flex items-center gap-4 transition-all duration-300 ${
        isTopThree ? "scale-[1.02]" : ""
      }`}
      style={{
        boxShadow: isTopThree ? rankStyle.shadow : undefined,
        borderImage: isTopThree ? `${rankStyle.gradient} 1` : undefined,
        borderWidth: isTopThree ? "2px" : undefined,
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ background: rankStyle.gradient }}
      >
        {entry.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text-primary truncate">{entry.name}</div>
        {showCompany && entry.companyName && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">
            {entry.companyName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-xs text-text-secondary">Appointments</div>
          <div className="font-semibold tabular-nums">{entry.appointments}</div>
        </div>
        {entry.seats !== undefined && (
          <div className="text-right">
            <div className="text-xs text-text-secondary">Seats</div>
            <div className="font-semibold tabular-nums">{entry.seats}</div>
          </div>
        )}
        {entry.weeklyAvg !== undefined && (
          <div className="text-right">
            <div className="text-xs text-text-secondary">Wk Avg</div>
            <div className="font-semibold tabular-nums">{entry.weeklyAvg.toFixed(1)}</div>
          </div>
        )}
        <AchievementBadge percentage={entry.achievement} />
      </div>
    </div>
  );
}
