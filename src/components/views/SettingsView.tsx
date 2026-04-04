import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { EmployeeManagement } from "@/components/settings/EmployeeManagement";
import type { Client } from "@/types";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, UserPlus, X, Check } from "lucide-react";

const statusOptions = ["active", "paused", "churned"] as const;

type SettingsTab = "clients" | "employees";

export function SettingsView() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Client login modal
  const [loginModal, setLoginModal] = useState<{ client: Client } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSending, setLoginSending] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newRow, setNewRow] = useState({
    company_id: "",
    company_name: "",
    seats_purchased: 1,
    status: "active" as Client["status"],
    onboarding_date: "",
    launch_date: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("company_name");
    setClients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleUpdate = async (id: string, field: string, value: string | number) => {
    await supabase.from("clients").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
    fetchClients();
  };

  const handleAdd = async () => {
    if (!newRow.company_id || !newRow.company_name) return;
    setSaving(true);
    await supabase.from("clients").insert({
      company_id: newRow.company_id,
      company_name: newRow.company_name,
      seats_purchased: newRow.seats_purchased,
      status: newRow.status,
      onboarding_date: newRow.onboarding_date || null,
      launch_date: newRow.launch_date || null,
      contact_email: newRow.contact_email || null,
      contact_phone: newRow.contact_phone || null,
      notes: newRow.notes || null,
    });
    setNewRow({
      company_id: "", company_name: "", seats_purchased: 1, status: "active",
      onboarding_date: "", launch_date: "", contact_email: "", contact_phone: "", notes: "",
    });
    setSaving(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  const openLoginModal = (client: Client) => {
    setLoginModal({ client });
    setLoginEmail(client.contact_email ?? "");
    setLoginMsg(null);
    setLoginSending(false);
  };

  const handleCreateLogin = async () => {
    if (!loginModal || !loginEmail) return;
    setLoginSending(true);
    setLoginMsg(null);

    try {
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: loginEmail,
        password: tempPassword,
      });

      if (signUpError) {
        setLoginMsg({ type: "error", text: signUpError.message });
        setLoginSending(false);
        return;
      }

      const newUserId = signUpData.user?.id;
      if (!newUserId) {
        setLoginMsg({ type: "error", text: "Failed to create user account." });
        setLoginSending(false);
        return;
      }

      const clientPerms = {
        name: loginModal.client.company_name,
        can_view_overview: true,
        can_view_performance: true,
        can_view_leaderboard: false,
        can_view_historical: true,
        can_view_settings: false,
        can_view_contacts: false,
        can_view_recordings: false,
        can_view_credit_scores: false,
        can_view_commissions: false,
        can_view_all_clients: false,
        restricted_client_ids: [],
      };

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: "client",
        company_id: loginModal.client.company_id,
        permissions: clientPerms,
      });

      if (roleError) {
        setLoginMsg({ type: "error", text: roleError.message });
      } else {
        setLoginMsg({ type: "success", text: `Login created for ${loginEmail}` });
        setTimeout(() => setLoginModal(null), 2000);
      }
    } catch (err) {
      setLoginMsg({ type: "error", text: err instanceof Error ? err.message : "An error occurred" });
    }
    setLoginSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-6"
    >
      <h1 className="text-xl font-bold text-primary mb-1">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage clients, employees, and dashboard access.
      </p>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-6 border-b border-border mb-6">
          <button
            onClick={() => setTab("clients")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              tab === "clients" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Client Management
            {tab === "clients" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setTab("employees")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              tab === "employees" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Employee Management
            {tab === "employees" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {tab === "clients" ? (
        <>
          {/* Existing Clients */}
          <div className="glass-card overflow-x-auto mb-6">
            <div className="grid grid-cols-9 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 min-w-[1000px]">
              <div>Company ID</div>
              <div>Company Name</div>
              <div>Seats</div>
              <div>Status</div>
              <div>Launch Date</div>
              <div>Email</div>
              <div>Phone</div>
              <div className="text-center">Login</div>
              <div></div>
            </div>
            {clients.map((client) => (
              <div key={client.id} className="grid grid-cols-9 gap-2 px-4 py-3 items-center border-b border-border min-w-[1000px]">
                <div className="text-sm text-muted-foreground tabular-nums truncate" title={client.company_id}>
                  {client.company_id}
                </div>
                <div className="text-sm font-medium text-foreground truncate">{client.company_name}</div>
                <div>
                  <input
                    type="number"
                    min={1}
                    value={client.seats_purchased}
                    onChange={(e) => handleUpdate(client.id, "seats_purchased", parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <select
                    value={client.status}
                    onChange={(e) => handleUpdate(client.id, "status", e.target.value)}
                    className="px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="date"
                    value={client.launch_date ?? ""}
                    onChange={(e) => handleUpdate(client.id, "launch_date", e.target.value)}
                    className="px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={client.contact_email ?? ""}
                    onChange={(e) => handleUpdate(client.id, "contact_email", e.target.value)}
                    placeholder="email"
                    className="w-full px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={client.contact_phone ?? ""}
                    onChange={(e) => handleUpdate(client.id, "contact_phone", e.target.value)}
                    placeholder="phone"
                    className="w-full px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="text-center">
                  <button
                    onClick={() => openLoginModal(client)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Create client login"
                  >
                    <UserPlus size={12} />
                    Create Login
                  </button>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete client"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Client */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Add New Client
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Company ID (GHL Location)</label>
                <input
                  type="text"
                  value={newRow.company_id}
                  onChange={(e) => setNewRow({ ...newRow, company_id: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                  placeholder="e.g. loc_abc123"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Company Name</label>
                <input
                  type="text"
                  value={newRow.company_name}
                  onChange={(e) => setNewRow({ ...newRow, company_name: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                  placeholder="e.g. Acme Solar"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Seats Purchased</label>
                <input
                  type="number"
                  min={1}
                  value={newRow.seats_purchased}
                  onChange={(e) => setNewRow({ ...newRow, seats_purchased: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select
                  value={newRow.status}
                  onChange={(e) => setNewRow({ ...newRow, status: e.target.value as Client["status"] })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Onboarding Date</label>
                <input
                  type="date"
                  value={newRow.onboarding_date}
                  onChange={(e) => setNewRow({ ...newRow, onboarding_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Launch Date</label>
                <input
                  type="date"
                  value={newRow.launch_date}
                  onChange={(e) => setNewRow({ ...newRow, launch_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Contact Email</label>
                <input
                  type="email"
                  value={newRow.contact_email}
                  onChange={(e) => setNewRow({ ...newRow, contact_email: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={newRow.contact_phone}
                  onChange={(e) => setNewRow({ ...newRow, contact_phone: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  value={newRow.notes}
                  onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                  className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !newRow.company_id || !newRow.company_name}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-primary disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Client
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmployeeManagement />
      )}

      {/* Client Login Modal */}
      {loginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setLoginModal(null)} />
          <div
            className="relative w-full max-w-md mx-4 rounded-lg border border-border p-6"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                Create Client Login
              </h3>
              <button
                onClick={() => setLoginModal(null)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Create a dashboard login for <span className="text-foreground font-medium">{loginModal.client.company_name}</span>.
              They will only see their own company data.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="client@company.com"
                />
              </div>

              {loginMsg && (
                <div
                  className={`rounded-md px-3 py-2 text-sm flex items-center gap-2 ${
                    loginMsg.type === "success"
                      ? "bg-success/10 border border-success/30 text-success"
                      : "bg-destructive/10 border border-destructive/30 text-destructive"
                  }`}
                >
                  {loginMsg.type === "success" && <Check size={14} />}
                  {loginMsg.text}
                </div>
              )}

              <button
                onClick={handleCreateLogin}
                disabled={loginSending || !loginEmail}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loginSending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create Client Login
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
