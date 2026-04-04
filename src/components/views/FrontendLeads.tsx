import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { FrontendMetric, DateRange } from "@/types";
// Date filtering uses raw comparison from dateRange prop
import {
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Columns3,
  Search,
} from "lucide-react";

interface FrontendLeadsProps {
  dateRange: DateRange;
}

interface ColumnDef {
  key: keyof FrontendMetric;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "Lead Name", label: "Lead Name", defaultVisible: true },
  { key: "Date", label: "Date", defaultVisible: true },
  { key: "Campaign Name", label: "Campaign", defaultVisible: true },
  { key: "Status / Stage in Pipeline", label: "Status", defaultVisible: true },
  { key: "Phone Number", label: "Phone", defaultVisible: true },
  { key: "Email Address", label: "Email", defaultVisible: true },
  { key: "Closer", label: "Closer", defaultVisible: true },
  { key: "Setter", label: "Setter", defaultVisible: true },
  { key: "Appointment Booked", label: "Appt Booked", defaultVisible: true },
  { key: "Appointment Status", label: "Appt Status", defaultVisible: false },
  { key: "Appointment Show", label: "Appt Show", defaultVisible: false },
  { key: "Disposition/Outcome", label: "Disposition", defaultVisible: true },
  { key: "Deal Value", label: "Deal Value", defaultVisible: true },
  { key: "Notes/Comments", label: "Notes", defaultVisible: false },
  { key: "Cash Collected", label: "Cash Collected", defaultVisible: false },
  { key: "Pitch", label: "Pitch", defaultVisible: false },
  { key: "Source Campaign", label: "Source Campaign", defaultVisible: false },
  { key: "Tag(s)", label: "Tags", defaultVisible: false },
];

const STORAGE_KEY = "premura-frontend-leads-columns";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-primary transition-colors inline-flex"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-blue-400" /> : <Copy size={12} />}
    </button>
  );
}

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return raw; }
}

function cleanCampaignName(raw: string | null): string {
  if (!raw) return "";
  let s = raw.trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) s = String(arr[0]);
    } catch { /* use as-is */ }
  }
  s = s.replace(/^["']+|["']+$/g, "").trim();
  const dashIdx = s.lastIndexOf(" - ");
  if (dashIdx > 0) s = s.substring(dashIdx + 3).trim();
  return s;
}

function statusColor(status: string | null): string {
  if (!status) return "";
  const s = status.toLowerCase().trim();
  if (s === "sale" || s === "client closed") return "bg-green-500/10 text-green-400";
  if (s.includes("follow")) return "bg-orange-500/10 text-orange-400";
  if (s.includes("disqualif") || s.includes("not interested")) return "bg-red-500/10 text-red-400";
  if (s.includes("booked") || s.includes("new")) return "bg-blue-500/10 text-blue-400";
  return "bg-muted/20 text-muted-foreground";
}

export function FrontendLeads({ dateRange }: FrontendLeadsProps) {
  const [metrics, setMetrics] = useState<FrontendMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch { /* ignore */ }
    return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  });

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleKeys.has(c.key)),
    [visibleKeys]
  );

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("frontend_metrics").select("*");
      if (error) throw error;
      setMetrics((data as FrontendMetric[]) ?? []);
    } catch (err) {
      console.error("[FrontendLeads] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by date
  const filteredByDate = useMemo(() => {
    return metrics.filter((m) => {
      const raw = m["Date"];
      if (!raw) return true;
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return true;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
      } catch { return true; }
      return true;
    });
  }, [metrics, dateRange]);

  // Additional filters
  const filtered = useMemo(() => {
    let result = filteredByDate;
    if (statusFilter) {
      result = result.filter((m) => m["Status / Stage in Pipeline"] === statusFilter);
    }
    if (campaignFilter) {
      result = result.filter((m) =>
        cleanCampaignName(m["Campaign Name"] || m["Source Campaign"]) === campaignFilter
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => {
        const name = m["Lead Name"]?.toLowerCase() || "";
        const phone = m["Phone Number"]?.toLowerCase() || "";
        const email = m["Email Address"]?.toLowerCase() || "";
        const closer = m["Closer"]?.toLowerCase() || "";
        return name.includes(q) || phone.includes(q) || email.includes(q) || closer.includes(q);
      });
    }
    return result;
  }, [filteredByDate, statusFilter, campaignFilter, searchQuery]);

  // Unique values for filters
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    filteredByDate.forEach((m) => {
      const s = m["Status / Stage in Pipeline"]?.trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [filteredByDate]);

  const campaignOptions = useMemo(() => {
    const set = new Set<string>();
    filteredByDate.forEach((m) => {
      const c = cleanCampaignName(m["Campaign Name"] || m["Source Campaign"]);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [filteredByDate]);

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  const renderCell = (lead: FrontendMetric, col: ColumnDef) => {
    const val = lead[col.key];
    const str = val != null ? String(val) : "";

    switch (col.key) {
      case "Lead Name": {
        const contactUrl = lead["GHL Contact Link"];
        if (contactUrl) {
          return (
            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {str || "—"}
            </a>
          );
        }
        return <span className="font-medium text-foreground">{str || "—"}</span>;
      }

      case "Date":
      case "Date Appointment Booked":
        return <span>{formatDate(str || null)}</span>;

      case "Phone Number":
        return str ? (
          <span className="flex items-center gap-1">
            {str}
            <CopyButton text={str} />
          </span>
        ) : "—";

      case "Email Address":
        return str ? (
          <span className="flex items-center gap-1">
            <span className="truncate max-w-[160px]">{str}</span>
            <CopyButton text={str} />
          </span>
        ) : "—";

      case "Status / Stage in Pipeline":
        return str ? (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(str)}`}>
            {str}
          </span>
        ) : "—";

      case "Campaign Name":
      case "Source Campaign":
        return <span>{cleanCampaignName(str) || "—"}</span>;

      case "Deal Value":
      case "Cash Collected":
        return <span className="tabular-nums">{str || "—"}</span>;

      case "Notes/Comments":
        if (!str) return "—";
        return <span className="max-w-[250px] truncate block" title={str}>{str}</span>;

      default:
        return <span>{str || "—"}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="mb-3 sm:mb-4 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-primary mb-1">Leads</h1>
        <p className="text-muted-foreground text-sm">View and manage all frontend sales leads.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads..."
            className="rounded-md border border-border bg-card text-foreground pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-[180px]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs"
          >
            <Columns3 size={14} />
            Columns
            {showColumnPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
              <div
                className="fixed inset-4 z-50 rounded-lg border border-border p-2 shadow-xl overflow-y-auto sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:w-56 sm:max-h-80"
                style={{ background: "#111827" }}
              >
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                {ALL_COLUMNS.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted/20 transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      visibleKeys.has(col.key) ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {visibleKeys.has(col.key) && <Check size={10} className="text-white" />}
                    </div>
                    {col.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border" style={{ background: "#111827" }}>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    style={{ background: "#111827" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-muted-foreground">
                    No leads found for the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((lead, idx) => (
                  <tr key={lead.id ?? idx} className="border-b border-border hover:bg-muted/10 transition-colors">
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-sm text-foreground whitespace-nowrap ${
                          col.key === "Notes/Comments" ? "!whitespace-normal max-w-[250px]" : ""
                        }`}
                      >
                        {renderCell(lead, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
