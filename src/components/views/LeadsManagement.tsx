import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getEffectiveDateRange, getEarliestDate, toInputDate } from "@/lib/dateUtils";
import type { Appointment, DateRange } from "@/types";
import {
  Loader2,
  Copy,
  Check,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  Columns3,
} from "lucide-react";

interface LeadsManagementProps {
  dateRange: DateRange;
}

interface ColumnDef {
  key: string;
  label: string;
  permKey?: "can_view_contacts" | "can_view_recordings" | "can_view_credit_scores";
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Lead Name", defaultVisible: true },
  { key: "Company Name", label: "Company Name", defaultVisible: true },
  { key: "booked_for", label: "Booked For", defaultVisible: true },
  { key: "setter_name", label: "Setter", defaultVisible: true },
  { key: "phone_number", label: "Phone", permKey: "can_view_contacts", defaultVisible: true },
  { key: "email", label: "Email", permKey: "can_view_contacts", defaultVisible: true },
  { key: "notes", label: "Notes", defaultVisible: true },
  { key: "address", label: "Address", defaultVisible: true },
  { key: "recording_media_link", label: "Recording", permKey: "can_view_recordings", defaultVisible: true },
  { key: "credit_score", label: "Credit Score", permKey: "can_view_credit_scores", defaultVisible: true },
  { key: "roof_type", label: "Roof Type", defaultVisible: false },
  { key: "existing_solar", label: "Existing Solar", defaultVisible: false },
  { key: "shading", label: "Shading", defaultVisible: false },
  { key: "closer_name", label: "Closer", defaultVisible: true },
  { key: "disposition_date", label: "Disposition Date", defaultVisible: false },
  { key: "dq_reason", label: "DQ Reason", defaultVisible: false },
];

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
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

function formatBookedFor(raw: string | null): string {
  if (!raw) return "\u2014";
  // Try to parse "Thursday, April 2, 2026 3:30 PM" style
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch { /* fall through */ }
  return raw;
}

export function LeadsManagement({ dateRange }: LeadsManagementProps) {
  const { userRole, isAdmin, hasPermission } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("");

  // Initialize visible columns based on permissions
  const permittedColumns = useMemo(() => {
    return ALL_COLUMNS.filter((col) => {
      if (!col.permKey) return true;
      return isAdmin || hasPermission(col.permKey);
    });
  }, [isAdmin, hasPermission]);

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    return new Set(permittedColumns.filter((c) => c.defaultVisible).map((c) => c.key));
  });

  const visibleColumns = useMemo(
    () => permittedColumns.filter((c) => visibleKeys.has(c.key)),
    [permittedColumns, visibleKeys]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("appointments_new").select("*");
      if (error) throw error;
      setAppointments((data as Appointment[]) ?? []);
    } catch (err) {
      console.error("[LeadsManagement] fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Filter by date range
  const filteredByDate = useMemo(() => {
    const earliest = getEarliestDate(appointments);
    const { start, end } = getEffectiveDateRange(dateRange.start, dateRange.end, earliest);
    return appointments.filter((a) => {
      if (!a.created_at) return false;
      const d = new Date(a.created_at);
      return d >= start && d <= end;
    });
  }, [appointments, dateRange]);

  // Filter by client role
  const filteredByRole = useMemo(() => {
    if (isAdmin || userRole?.role !== "client") return filteredByDate;
    const companyId = userRole?.company_id;
    if (!companyId) return [];
    return filteredByDate.filter((a) => a.company_id === companyId);
  }, [filteredByDate, isAdmin, userRole]);

  // Filter by client dropdown
  const filtered = useMemo(() => {
    if (!clientFilter) return filteredByRole;
    return filteredByRole.filter((a) => a["Company Name"] === clientFilter);
  }, [filteredByRole, clientFilter]);

  // Unique company names for filter
  const companyNames = useMemo(() => {
    const names = new Set<string>();
    filteredByRole.forEach((a) => {
      if (a["Company Name"]) names.add(a["Company Name"]);
    });
    return Array.from(names).sort();
  }, [filteredByRole]);

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderCell = (appt: Appointment, col: ColumnDef) => {
    const val = (appt as unknown as Record<string, unknown>)[col.key];
    const str = val != null ? String(val) : "";

    switch (col.key) {
      case "name":
        return <span className="font-medium text-foreground">{str || "\u2014"}</span>;

      case "booked_for":
        return <span>{formatBookedFor(str || null)}</span>;

      case "phone_number":
        return str ? (
          <span className="flex items-center gap-1">
            {str}
            <CopyButton text={str} />
          </span>
        ) : "\u2014";

      case "email":
        return str ? (
          <span className="flex items-center gap-1">
            <span className="truncate max-w-[160px]">{str}</span>
            <CopyButton text={str} />
          </span>
        ) : "\u2014";

      case "notes":
        if (!str) return "\u2014";
        const isExpanded = expandedNotes.has(appt.id);
        if (str.length <= 50) return <span>{str}</span>;
        return (
          <button
            onClick={() => toggleNote(appt.id)}
            className="text-left hover:text-primary transition-colors"
          >
            {isExpanded ? str : `${str.slice(0, 50)}...`}
          </button>
        );

      case "recording_media_link":
        return str ? (
          <a
            href={str}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex"
            title="Play recording"
          >
            <Play size={12} />
          </a>
        ) : "\u2014";

      case "existing_solar":
        if (!str) return "\u2014";
        const isSolar = str.toLowerCase() === "yes" || str.toLowerCase() === "true";
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isSolar ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"
          }`}>
            {isSolar ? "Yes" : "No"}
          </span>
        );

      default:
        return <span>{str || "\u2014"}</span>;
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-1">Leads Management</h1>
        <p className="text-muted-foreground text-sm">
          View and manage all appointment leads.
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Client filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Companies</option>
          {companyNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Date display */}
        <div className="text-xs text-muted-foreground">
          {dateRange.start ? toInputDate(dateRange.start) : "All time"} — {dateRange.end ? toInputDate(dateRange.end) : "Now"}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </div>

        {/* Column visibility */}
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
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border p-2 shadow-xl max-h-80 overflow-y-auto"
                style={{ background: "#111827" }}
              >
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                {permittedColumns.map((col) => (
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
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap ${
                    col.key === "name" ? "sticky left-0 z-10 bg-muted/30" : ""
                  }`}
                  style={col.key === "name" ? { background: "#111827" } : undefined}
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
              filtered.map((appt) => (
                <tr key={appt.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-sm text-foreground whitespace-nowrap ${
                        col.key === "name" ? "sticky left-0 z-10 font-medium" : ""
                      } ${col.key === "notes" ? "!whitespace-normal max-w-[250px]" : ""}`}
                      style={col.key === "name" ? { background: "#111827" } : undefined}
                    >
                      {renderCell(appt, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
