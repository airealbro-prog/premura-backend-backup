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
  LogOut,
} from "lucide-react";
import type { ViewType } from "@/types";
import { useAuth } from "@/lib/auth";
import premuraLogo from "@/assets/premura-logo.png";

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
  const { user, signOut } = useAuth();

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border bg-card"
    >
      {/* Logo + brand */}
      <div className="h-14 flex items-center gap-2.5 px-3 border-b border-border overflow-hidden">
        <img
          src={premuraLogo}
          alt="Premura"
          className="h-9 w-9 object-contain shrink-0"
        />
        {!collapsed && (
          <span className="gradient-text text-lg font-bold tracking-wide truncate">
            Premura
          </span>
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
                className="relative z-10 shrink-0"
                style={isActive ? { color: "#00d4ff" } : undefined}
              />
              {!collapsed && (
                <span className="relative z-10 text-sm font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User + Sign Out */}
      <div className="border-t border-border px-2 py-2 space-y-1">
        {/* User email */}
        {!collapsed && user?.email && (
          <div className="px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}

        {/* Sign Out button */}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 rounded-md w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-left"
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

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
