import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Trophy,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ViewType } from "@/types";

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems: { view: ViewType; label: string; icon: typeof BarChart3 }[] = [
  { view: "overview", label: "Overview", icon: BarChart3 },
  { view: "clients", label: "Performance", icon: Building2 },
  { view: "leaderboard", label: "Leaderboard", icon: Trophy },
  { view: "historical", label: "Historical", icon: CalendarDays },
  { view: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border bg-card"
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center px-4 border-b border-border">
        {collapsed ? (
          <span className="gradient-text text-xl font-bold">P</span>
        ) : (
          <span className="gradient-text text-xl font-bold tracking-wide">Premura</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {navItems.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 text-left w-full ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md"
                  style={{ background: "linear-gradient(135deg, rgba(123,47,247,0.25), rgba(0,212,255,0.12))" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon
                size={18}
                className="relative z-10"
                style={isActive ? { color: "#00d4ff" } : undefined}
              />
              {!collapsed && (
                <span className="relative z-10 text-sm font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-border text-muted-foreground hover:text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
