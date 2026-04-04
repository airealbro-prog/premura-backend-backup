import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Trophy,
  CalendarDays,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import type { ViewType } from "@/types";
import { useAuth } from "@/lib/auth";
import type { UserPermissions } from "@/lib/auth";
import premuraLogo from "@/assets/premura-logo-transparent.png";

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems: { view: ViewType; label: string; icon: typeof BarChart3; permKey: keyof UserPermissions }[] = [
  { view: "overview", label: "Overview", icon: BarChart3, permKey: "can_view_overview" },
  { view: "clients", label: "Performance", icon: Building2, permKey: "can_view_performance" },
  { view: "leaderboard", label: "Leaderboard", icon: Trophy, permKey: "can_view_leaderboard" },
  { view: "historical", label: "Historical", icon: CalendarDays, permKey: "can_view_historical" },
  { view: "leads", label: "Leads", icon: ClipboardList, permKey: "can_view_overview" },
  { view: "settings", label: "Settings", icon: Settings, permKey: "can_view_settings" },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, userRole, isAdmin, hasPermission, signOut } = useAuth();

  const isClient = userRole?.role === "client";
  const isClientAdmin = (userRole as { role: string } | null)?.role === "client_admin";
  const brandName = (isClient || isClientAdmin) && userRole?.permissions?.name
    ? userRole.permissions.name
    : "Premura";

  const visibleItems = navItems.filter((item) => {
    // Agency admins see everything
    if (isAdmin) return true;
    // Client users: hide Leaderboard entirely, hide Settings unless client_admin
    if (isClient || isClientAdmin) {
      if (item.view === "leaderboard") return false;
      if (item.view === "settings" && !isClientAdmin) return false;
    }
    return hasPermission(item.permKey);
  });

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border"
      style={{ background: "#0f172a" }}
    >
      {/* Logo + brand */}
      <div className="h-14 flex items-center gap-2.5 px-3 border-b border-border overflow-hidden">
        <img
          src={premuraLogo}
          alt="Premura"
          className="h-9 w-9 object-contain shrink-0"
        />
        {!collapsed && (
          <span className="text-white text-lg font-bold tracking-wide truncate">
            {brandName}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {visibleItems.map(({ view, label, icon: Icon }) => {
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
                  style={{ background: "rgba(136, 81, 244, 0.15)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon
                size={18}
                className="relative z-10 shrink-0"
                style={isActive ? { color: "#8851F4" } : undefined}
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
        {!collapsed && user?.email && (
          <div className="px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
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
