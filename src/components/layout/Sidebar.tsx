import { useState } from "react";
import {
  BarChart3,
  Building2,
  User,
  Trophy,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ViewType } from "../../types";

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems: { view: ViewType; label: string; icon: typeof BarChart3 }[] = [
  { view: "overview", label: "Overview", icon: BarChart3 },
  { view: "clients", label: "Client View", icon: Building2 },
  { view: "agents", label: "Agent View", icon: User },
  { view: "leaderboard", label: "Leaderboard", icon: Trophy },
  { view: "historical", label: "Historical", icon: CalendarDays },
  { view: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col border-r border-border-subtle transition-all duration-300"
      style={{
        width: collapsed ? "64px" : "220px",
        background: "#16213e",
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center px-4 border-b border-border-subtle">
        {collapsed ? (
          <span className="gradient-text text-xl font-bold">P</span>
        ) : (
          <span className="gradient-text text-xl font-bold tracking-wide">
            Premura
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left w-full ${
                isActive
                  ? "text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              }`}
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, rgba(123,47,247,0.3), rgba(0,212,255,0.15))",
                    }
                  : undefined
              }
              title={collapsed ? label : undefined}
            >
              <Icon
                size={20}
                style={
                  isActive
                    ? { color: "#00d4ff" }
                    : undefined
                }
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-border-subtle text-text-secondary hover:text-accent-cyan transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
