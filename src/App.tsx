import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldX, X } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileMenuButton } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Overview } from "@/components/views/Overview";
import { PerformanceView } from "@/components/views/PerformanceView";
import { Leaderboard } from "@/components/views/Leaderboard";
import { HistoricalAnalysis } from "@/components/views/HistoricalAnalysis";
import { SettingsView } from "@/components/views/SettingsView";
import { LeadsManagement } from "@/components/views/LeadsManagement";
import { FrontendOverview } from "@/components/views/FrontendOverview";
import { FrontendPipeline } from "@/components/views/FrontendPipeline";
import { FrontendLeads } from "@/components/views/FrontendLeads";
import { DialerData } from "@/components/views/DialerData";
import { PlaceholderView } from "@/components/views/PlaceholderView";
import { getDefaultDateRange } from "@/lib/dateUtils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { UserPermissions } from "@/lib/auth";
import type { ViewType, FilterState, DateRange, DashboardMode, Client } from "@/types";

const DASHBOARD_MODE_KEY = "premura-dashboard-mode";

const defaultDateRange = getDefaultDateRange();

const defaultFilters: FilterState = {
  dateRange: defaultDateRange,
  selectedClients: [],
  achievementTier: "all",
  searchQuery: "",
  timeFilter: "custom",
};

const viewPermMap: Partial<Record<ViewType, keyof UserPermissions>> = {
  overview: "can_view_overview",
  clients: "can_view_performance",
  leaderboard: "can_view_leaderboard",
  historical: "can_view_historical",
  leads: "can_view_leads",
  dialer: "can_view_overview",
  settings: "can_view_settings",
  fe_overview: "can_view_overview",
  fe_pipeline: "can_view_performance",
  fe_leads: "can_view_leads",
  // Client Journey + Agent Journey views use can_view_overview as base permission
  cj_overview: "can_view_overview",
  cj_payments: "can_view_overview",
  cj_meetings: "can_view_overview",
  cj_profiles: "can_view_overview",
  aj_overview: "can_view_overview",
  aj_dialer: "can_view_overview",
  aj_training: "can_view_overview",
  aj_updates: "can_view_overview",
  aj_hr: "can_view_overview",
  tickets: "can_view_overview",
};

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <ShieldX size={48} className="text-muted-foreground" />
      <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
      <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
    </div>
  );
}

function App() {
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_MODE_KEY);
      if (saved === "frontend" || saved === "backend") return saved;
    } catch { /* ignore */ }
    return "backend";
  });
  const [activeView, setActiveView] = useState<ViewType>("overview");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { userRole, isAdmin, hasPermission, isImpersonating, impersonateName, impersonateRole, exitImpersonation } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [overviewClientOptions, setOverviewClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const isClientUser = userRole?.role === "client" || (userRole as { role: string } | null)?.role === "client_admin";
  const dashboardAccess = userRole?.dashboardAccess ?? ["backend"];

  // Force correct dashboard mode based on access
  useEffect(() => {
    if (isClientUser && dashboardMode !== "backend") {
      setDashboardMode("backend");
      return;
    }
    // If user only has access to one dashboard, force that mode
    if (dashboardAccess.length === 1 && dashboardMode !== dashboardAccess[0]) {
      setDashboardMode(dashboardAccess[0] as DashboardMode);
      try { localStorage.setItem(DASHBOARD_MODE_KEY, dashboardAccess[0]); } catch { /* ignore */ }
      // Navigate to default view for forced mode
      if (dashboardAccess[0] === "frontend") {
        setActiveView("fe_overview");
      } else {
        setActiveView("overview");
      }
      return;
    }
    // If current mode is not in their access list, switch to first allowed
    if (!dashboardAccess.includes(dashboardMode)) {
      const fallback = dashboardAccess[0] as DashboardMode;
      setDashboardMode(fallback);
      try { localStorage.setItem(DASHBOARD_MODE_KEY, fallback); } catch { /* ignore */ }
      setActiveView(fallback === "frontend" ? "fe_overview" : "overview");
    }
  }, [isClientUser, dashboardMode, dashboardAccess]);

  const handleDashboardModeChange = useCallback((mode: DashboardMode) => {
    // Prevent switching to a dashboard the user doesn't have access to
    if (!dashboardAccess.includes(mode)) return;
    setDashboardMode(mode);
    try { localStorage.setItem(DASHBOARD_MODE_KEY, mode); } catch { /* ignore */ }
    // Navigate to the default view for the new mode
    const defaultViews: Record<DashboardMode, ViewType> = {
      backend: "overview",
      frontend: "fe_overview",
      client_journey: "cj_overview",
      agent_journey: "aj_overview",
    };
    setActiveView(defaultViews[mode] ?? "overview");
  }, [dashboardAccess]);

  useEffect(() => {
    if (isClientUser && userRole?.company_id) {
      supabase
        .from("clients")
        .select("company_name")
        .eq("company_id", userRole.company_id)
        .single()
        .then(({ data }) => {
          if (data?.company_name) setCompanyName(data.company_name);
        });
    } else {
      setCompanyName(null);
    }
  }, [isClientUser, userRole?.company_id]);

  // Fetch client options for the Overview client filter
  useEffect(() => {
    if (isClientUser) return;
    supabase
      .from("clients")
      .select("company_id, company_name")
      .order("company_name")
      .then(({ data }) => {
        if (data) {
          setOverviewClientOptions(
            data.map((d: Pick<Client, "company_id" | "company_name">) => ({
              id: d.company_id,
              name: d.company_name,
            }))
          );
        }
      });
  }, [isClientUser]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setFilters((f) => ({ ...f }));
  }, []);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setFilters((f) => ({ ...f, dateRange: range }));
  }, []);

  const renderView = () => {
    const permKey = viewPermMap[activeView];
    if (permKey && !isAdmin && !hasPermission(permKey)) {
      return <AccessDenied />;
    }

    switch (activeView) {
      // Backend views
      case "overview":
        return <Overview key={refreshKey} dateRange={filters.dateRange} selectedCompanyId={selectedCompanyId} />;
      case "clients":
        return <PerformanceView key={refreshKey} filters={filters} onFiltersChange={setFilters} />;
      case "leaderboard":
        return <Leaderboard key={refreshKey} filters={filters} onFiltersChange={setFilters} />;
      case "historical":
        return <HistoricalAnalysis key={refreshKey} filters={filters} onFiltersChange={setFilters} />;
      case "leads":
        return <LeadsManagement key={refreshKey} dateRange={filters.dateRange} />;
      case "dialer":
        return <DialerData key={refreshKey} dateRange={filters.dateRange} />;
      case "settings":
        return <SettingsView key={refreshKey} />;
      // Frontend views
      case "fe_overview":
        return <FrontendOverview key={refreshKey} dateRange={filters.dateRange} />;
      case "fe_pipeline":
        return <FrontendPipeline key={refreshKey} dateRange={filters.dateRange} />;
      case "fe_leads":
        return <FrontendLeads key={refreshKey} dateRange={filters.dateRange} />;
      // Client Journey views
      case "cj_overview":
        return <PlaceholderView key={refreshKey} title="Client Overview" description="View all clients with key business metrics, lifetime value, payment status, and churn analysis." />;
      case "cj_payments":
        return <PlaceholderView key={refreshKey} title="Payment Tracker" description="Track all client payments, failed payments, and upcoming payment forecasts." />;
      case "cj_meetings":
        return <PlaceholderView key={refreshKey} title="Meeting Logs" description="Log client meetings with Fathom links, AI summaries, and action items." />;
      case "cj_profiles":
        return <PlaceholderView key={refreshKey} title="Client Profiles" description="Detailed client profiles with business info, onboarding data, and performance summaries." />;
      // Agent Journey views
      case "aj_overview":
        return <PlaceholderView key={refreshKey} title="Agent Overview" description="Historical view of each agent's journey — status, assignments, achievement, and lifecycle." />;
      case "aj_dialer":
        return <DialerData key={refreshKey} dateRange={filters.dateRange} />;
      case "aj_training":
        return <PlaceholderView key={refreshKey} title="Training" description="Training sessions, recording links, attendance tracking, and completion status." />;
      case "aj_updates":
        return <PlaceholderView key={refreshKey} title="Agent Updates" description="Log of agent-related updates: performance notes, warnings, promotions, and schedule changes." />;
      case "aj_hr":
        return <PlaceholderView key={refreshKey} title="HR Dashboard" description="Hiring funnel analytics, recruitment metrics, and ad campaign performance." />;
      // Tickets
      case "tickets":
        return <PlaceholderView key={refreshKey} title="Ticket System" description="Submit and track support tickets with priority, category, and comment threads." />;
      default:
        return <Overview key={refreshKey} dateRange={filters.dateRange} selectedCompanyId={selectedCompanyId} />;
    }
  };

  // Determine TopBar labels based on mode
  const viewLabelsForTopBar: Partial<Record<ViewType, string>> = dashboardMode === "frontend"
    ? { fe_overview: "Sales Overview", fe_pipeline: "Pipeline", fe_leads: "Leads", settings: "Settings" }
    : {};

  // Show client filter only on backend overview
  const showClientFilter = activeView === "overview" && dashboardMode === "backend" && !isClientUser;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
        dashboardMode={dashboardMode}
        onDashboardModeChange={handleDashboardModeChange}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-orange-500/15 border-b border-orange-500/30 text-orange-300 text-sm shrink-0">
            <span className="text-xs sm:text-sm">
              Viewing as: <strong>{impersonateName}</strong> — <span className="capitalize">{impersonateRole?.replace("_", " ")}</span>
            </span>
            <button
              onClick={exitImpersonation}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-medium transition-colors"
            >
              <X size={12} />
              Exit
            </button>
          </div>
        )}
        <TopBar
          currentView={activeView}
          onRefresh={handleRefresh}
          isConnected={true}
          dateRange={filters.dateRange}
          onDateRangeChange={handleDateRangeChange}
          companyName={isClientUser ? companyName : null}
          mobileMenuButton={<MobileMenuButton onClick={() => setMobileOpen(true)} />}
          clientOptions={showClientFilter ? overviewClientOptions : undefined}
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={showClientFilter ? setSelectedCompanyId : undefined}
          viewLabelOverrides={viewLabelsForTopBar}
        />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
