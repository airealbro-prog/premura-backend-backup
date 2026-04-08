import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Building2,
  Trophy,
  CalendarDays,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Monitor,
  Globe,
  GitBranch,
  Users,
} from "lucide-react";
import type { ViewType, DashboardMode } from "@/types";
import { useAuth } from "@/lib/auth";
import type { UserPermissions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import premuraLogo from "@/assets/premura-logo-transparent.png";

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
  dashboardMode: DashboardMode;
  onDashboardModeChange: (mode: DashboardMode) => void;
}

const backendNavItems: { view: ViewType; label: string; icon: typeof BarChart3; permKey: keyof UserPermissions }[] = [
  { view: "overview", label: "Overview", icon: BarChart3, permKey: "can_view_overview" },
  { view: "clients", label: "Performance", icon: Building2, permKey: "can_view_performance" },
  { view: "leaderboard", label: "Leaderboard", icon: Trophy, permKey: "can_view_leaderboard" },
  { view: "historical", label: "Historical", icon: CalendarDays, permKey: "can_view_historical" },
  { view: "leads", label: "Leads", icon: ClipboardList, permKey: "can_view_leads" },
  { view: "settings", label: "Settings", icon: Settings, permKey: "can_view_settings" },
];

const frontendNavItems: { view: ViewType; label: string; icon: typeof BarChart3; permKey: keyof UserPermissions }[] = [
  { view: "fe_overview", label: "Overview", icon: BarChart3, permKey: "can_view_overview" },
  { view: "fe_pipeline", label: "Pipeline", icon: GitBranch, permKey: "can_view_performance" },
  { view: "fe_leads", label: "Leads", icon: Users, permKey: "can_view_leads" },
  { view: "settings", label: "Settings", icon: Settings, permKey: "can_view_settings" },
];

export function Sidebar({ activeView, onNavigate, mobileOpen, onMobileToggle, dashboardMode, onDashboardModeChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, userRole, isAdmin, hasPermission, signOut } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const switcherBtnRef = useRef<HTMLButtonElement>(null);
  const [switcherPos, setSwitcherPos] = useState({ top: 0, left: 0 });

  const isClient = userRole?.role === "client";
  const isClientAdmin = (userRole as { role: string } | null)?.role === "client_admin";
  const dashboardAccess = userRole?.dashboardAccess ?? ["backend"];
  const showDashboardSwitcher = !isClient && !isClientAdmin && dashboardAccess.length > 1;
  const [clientAgentCount, setClientAgentCount] = useState(0);

  useEffect(() => {
    if ((isClient || isClientAdmin) && userRole?.company_id) {
      supabase
        .from("appointments_new")
        .select("setter_name")
        .eq("company_id", userRole.company_id)
        .then(({ data }) => {
          if (data) {
            const unique = new Set(data.map((d) => d.setter_name?.trim()).filter(Boolean));
            setClientAgentCount(unique.size);
          }
        });
    }
  }, [isClient, isClientAdmin, userRole?.company_id]);

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const navItems = dashboardMode === "frontend" ? frontendNavItems : backendNavItems;

  const visibleItems = navItems.filter((item) => {
    if (isAdmin) return true;
    if (isClient || isClientAdmin) {
      if (item.view === "leaderboard") return clientAgentCount >= 5;
      if (item.view === "settings" && !isClientAdmin) return false;
    }
    return hasPermission(item.permKey);
  });

  const handleNav = (view: ViewType) => {
    onNavigate(view);
    if (mobileOpen) onMobileToggle();
  };

  const handleSwitchMode = (mode: DashboardMode) => {
    onDashboardModeChange(mode);
    setSwitcherOpen(false);
  };

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo + brand + switcher */}
      <div className="border-b border-border">
        <div className="h-14 flex items-center gap-2.5 px-3 overflow-hidden">
          <img src={premuraLogo} alt="Premura" className="h-9 w-9 object-contain shrink-0" />
          {(isMobile || !collapsed) && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white text-lg font-bold tracking-wide leading-tight">Premura</span>
              {showDashboardSwitcher && (
                <div ref={switcherRef}>
                  <button
                    ref={switcherBtnRef}
                    onClick={() => {
                      if (!switcherOpen && switcherBtnRef.current) {
                        const rect = switcherBtnRef.current.getBoundingClientRect();
                        setSwitcherPos({ top: rect.bottom + 4, left: rect.left });
                      }
                      setSwitcherOpen(!switcherOpen);
                    }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors -mt-0.5"
                  >
                    <span className="capitalize">{dashboardMode}</span>
                    <ChevronDown size={10} className={`transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              )}
            </div>
          )}
          {isMobile && (
            <button onClick={onMobileToggle} className="ml-auto p-1 text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {visibleItems.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => handleNav(view)}
              className={`relative flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md transition-all duration-150 text-left w-full ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title={!isMobile && collapsed ? label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId={isMobile ? "sidebar-active-mobile" : "sidebar-active"}
                  className="absolute inset-0 rounded-md"
                  style={{ background: "rgba(136, 81, 244, 0.15)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon size={18} className="relative z-10 shrink-0" style={isActive ? { color: "#8851F4" } : undefined} />
              {(isMobile || !collapsed) && (
                <span className="relative z-10 text-sm font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User + Sign Out */}
      <div className="border-t border-border px-2 py-2 space-y-1">
        {(isMobile || !collapsed) && user?.email && (
          <div className="px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-md w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-left"
          title={!isMobile && collapsed ? "Sign out" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {(isMobile || !collapsed) && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* Collapse (desktop only) */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-12 flex items-center justify-center border-t border-border text-muted-foreground hover:text-primary transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Dashboard mode switcher dropdown — rendered fixed to escape overflow */}
      <AnimatePresence>
        {switcherOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setSwitcherOpen(false)} />
            <motion.div
              ref={switcherRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="fixed w-52 rounded-lg border border-border shadow-2xl z-[61] py-1"
              style={{ background: "#1e293b", top: switcherPos.top, left: switcherPos.left }}
            >
              {dashboardAccess.includes("backend") && (
                <button
                  onClick={() => handleSwitchMode("backend")}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors ${
                    dashboardMode === "backend"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  }`}
                >
                  <Monitor size={15} className="shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Backend Dashboard</div>
                    <div className="text-[10px] text-muted-foreground">Call center & appointments</div>
                  </div>
                </button>
              )}
              {dashboardAccess.includes("frontend") && (
                <button
                  onClick={() => handleSwitchMode("frontend")}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors ${
                    dashboardMode === "frontend"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  }`}
                >
                  <Globe size={15} className="shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Frontend Dashboard</div>
                    <div className="text-[10px] text-muted-foreground">Sales pipeline & leads</div>
                  </div>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="h-screen sticky top-0 hidden md:flex flex-col border-r border-border"
        style={{ background: "#0f172a" }}
      >
        {sidebarContent(false)}
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              onClick={onMobileToggle}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col md:hidden"
              style={{ background: "#0f172a" }}
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Hamburger button for mobile — exported for use in TopBar/App
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors md:hidden"
      title="Menu"
    >
      <Menu size={20} />
    </button>
  );
}
