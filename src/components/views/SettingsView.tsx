import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { EmployeeManagement } from "@/components/settings/EmployeeManagement";
import type { Client } from "@/types";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  UserPlus,
  X,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
} from "lucide-react";

const statusOptions = ["active", "paused", "churned"] as const;

type SettingsTab = "clients" | "employees";

// --- Password helpers (shared with EmployeeManagement) ---
function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Premura${digits}!`;
}

function validatePassword(pw: string) {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
  };
}

function isPasswordValid(pw: string): boolean {
  const v = validatePassword(pw);
  return v.minLength && v.hasUpper && v.hasLower && v.hasNumber;
}

const PASSWORD_RULES: { key: keyof ReturnType<typeof validatePassword>; label: string }[] = [
  { key: "minLength", label: "At least 8 characters" },
  { key: "hasUpper", label: "One uppercase letter" },
  { key: "hasLower", label: "One lowercase letter" },
  { key: "hasNumber", label: "One number" },
];

const CLIENT_PERMISSION_LABELS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: "can_view_overview", label: "Can view Overview", defaultOn: true },
  { key: "can_view_performance", label: "Can view Performance", defaultOn: true },
  { key: "can_view_historical", label: "Can view Historical", defaultOn: true },
  { key: "can_view_contacts", label: "Can view contact info", defaultOn: false },
  { key: "can_view_recordings", label: "Can view recordings", defaultOn: false },
  { key: "can_view_credit_scores", label: "Can view credit scores", defaultOn: false },
  { key: "can_view_commissions", label: "Can view commissions", defaultOn: false },
  { key: "can_view_leads", label: "Can view Leads", defaultOn: true },
];

function getDefaultClientPerms() {
  const perms: Record<string, boolean | string[]> = {
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
    can_view_leads: true,
    restricted_client_ids: [],
  };
  return perms;
}

interface ClientUser {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, unknown>;
}

export function SettingsView() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Client user counts per company_id
  const [clientUserCounts, setClientUserCounts] = useState<Record<string, number>>({});

  // Manage Client Access modal
  const [modalClient, setModalClient] = useState<Client | null>(null);
  const [modalUsers, setModalUsers] = useState<ClientUser[]>([]);
  const [modalUsersLoading, setModalUsersLoading] = useState(false);

  // Add user form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<"client" | "client_admin">("client");
  const [formPerms, setFormPerms] = useState<Record<string, boolean | string[]>>(getDefaultClientPerms());
  const [formSending, setFormSending] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

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

  const fetchClientUserCounts = useCallback(async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("company_id")
      .in("role", ["client", "client_admin"]);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        if (r.company_id) counts[r.company_id] = (counts[r.company_id] || 0) + 1;
      });
      setClientUserCounts(counts);
    }
  }, []);

  useEffect(() => { fetchClients(); fetchClientUserCounts(); }, [fetchClients, fetchClientUserCounts]);

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

  const handleDeleteClient = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  // --- Modal ---
  const fetchModalUsers = useCallback(async (companyId: string) => {
    setModalUsersLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, role, permissions")
      .eq("company_id", companyId)
      .in("role", ["client", "client_admin"])
      .order("created_at", { ascending: true });
    setModalUsers(
      (data ?? []).map((d) => ({
        id: d.id,
        user_id: d.user_id,
        role: d.role,
        permissions: (d.permissions as Record<string, unknown>) ?? {},
      }))
    );
    setModalUsersLoading(false);
  }, []);

  const openModal = (client: Client) => {
    setModalClient(client);
    setFormName("");
    setFormEmail(client.contact_email ?? "");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("client");
    setFormPerms(getDefaultClientPerms());
    setFormMsg(null);
    setFormSending(false);
    setCreatedCreds(null);
    fetchModalUsers(client.company_id);
  };

  const closeModal = () => {
    setModalClient(null);
    setModalUsers([]);
    fetchClientUserCounts();
  };

  const handleDeleteUser = async (user: ClientUser) => {
    // Try RPC first
    const { error: rpcError } = await supabase.rpc("delete_user_completely", {
      target_user_id: user.user_id,
    });
    if (rpcError) {
      await supabase.from("user_roles").delete().eq("id", user.id);
    }
    if (modalClient) fetchModalUsers(modalClient.company_id);
  };

  const togglePerm = (key: string) => {
    setFormPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateUser = async () => {
    if (!modalClient || !formEmail || !formPassword) return;
    setFormSending(true);
    setFormMsg(null);
    setCreatedCreds(null);

    const permissionsJson: Record<string, unknown> = {
      ...formPerms,
      name: formName,
      email: formEmail,
    };

    try {
      let newUserId: string | undefined;

      // Try admin API first
      try {
        const adminRes = await (supabase.auth.admin as { createUser: (opts: Record<string, unknown>) => Promise<{ data: { user?: { id: string } | null }; error: { message: string } | null }> }).createUser({
          email: formEmail,
          password: formPassword,
          email_confirm: true,
          user_metadata: { name: formName },
        });
        if (adminRes.error) throw new Error(adminRes.error.message);
        newUserId = adminRes.data.user?.id;
      } catch {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: { data: { name: formName } },
        });
        if (signUpError) {
          setFormMsg({ type: "error", text: signUpError.message });
          setFormSending(false);
          return;
        }
        newUserId = signUpData.user?.id;
      }

      if (!newUserId) {
        setFormMsg({ type: "error", text: "Failed to create user account." });
        setFormSending(false);
        return;
      }

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: formRole,
        company_id: modalClient.company_id,
        permissions: permissionsJson,
      });

      if (roleError) {
        setFormMsg({ type: "error", text: roleError.message });
      } else {
        setCreatedCreds({ email: formEmail, password: formPassword });
        setFormMsg({ type: "success", text: "User created successfully!" });
        fetchModalUsers(modalClient.company_id);
        // Reset form for next user
        setFormName("");
        setFormEmail("");
        setFormPassword("");
        setShowPassword(false);
      }
    } catch (err) {
      setFormMsg({ type: "error", text: err instanceof Error ? err.message : "An error occurred" });
    }
    setFormSending(false);
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
              <div className="text-center">Access</div>
              <div></div>
            </div>
            {clients.map((client) => {
              const userCount = clientUserCounts[client.company_id] || 0;
              return (
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
                      onClick={() => openModal(client)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                        userCount > 0
                          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title="Manage client access"
                    >
                      {userCount > 0 ? <Users size={12} /> : <UserPlus size={12} />}
                      {userCount > 0 ? `Manage (${userCount})` : "Create Login"}
                    </button>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleDeleteClient(client.id)}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Manage Client Access Modal */}
      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div
            className="relative w-full max-w-lg mx-4 rounded-lg border border-border p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                Manage Client Access — {modalClient.company_name}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Existing users list */}
            <div className="mb-5">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Existing Users
              </h4>
              {modalUsersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : modalUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No users yet for this client.</p>
              ) : (
                <div className="space-y-2">
                  {modalUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-3 py-2 rounded-md border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {(u.permissions.name as string) || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {(u.permissions.email as string) || u.user_id.slice(0, 8) + "..."}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mx-2 shrink-0">
                        {u.role === "client_admin" ? "Admin" : "User"}
                      </span>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Remove user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add User section */}
            <div className="border-t border-border pt-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                Add User
              </h4>
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="user@company.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPassword(generatePassword());
                        setShowPassword(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap"
                    >
                      <RefreshCw size={14} />
                      Generate
                    </button>
                  </div>
                  {formPassword && (
                    <div className="mt-2 space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const met = validatePassword(formPassword)[rule.key];
                        return (
                          <div key={rule.key} className="flex items-center gap-1.5">
                            <Check size={12} className={met ? "text-green-400" : "text-muted-foreground/40"} />
                            <span className={`text-xs ${met ? "text-green-400" : "text-muted-foreground/60"}`}>
                              {rule.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as "client" | "client_admin")}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="client">Client User</option>
                    <option value="client_admin">Client Admin</option>
                  </select>
                </div>

                {/* Permission toggles */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                    Permissions
                  </label>
                  <div className="space-y-1.5">
                    {CLIENT_PERMISSION_LABELS.map((p) => {
                      const isOn = formPerms[p.key] === true;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePerm(p.key)}
                          className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-border hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-sm text-foreground">{p.label}</span>
                          <div
                            className={`relative w-9 h-[18px] rounded-full transition-colors ${
                              isOn ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                                isOn ? "translate-x-[18px]" : "translate-x-[2px]"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Messages */}
                {formMsg && (
                  <div className={`rounded-md px-3 py-2 text-sm ${
                    formMsg.type === "success"
                      ? "bg-success/10 border border-success/30 text-success"
                      : "bg-destructive/10 border border-destructive/30 text-destructive"
                  }`}>
                    <div className="flex items-center gap-2">
                      {formMsg.type === "success" && <Check size={14} />}
                      {formMsg.text}
                    </div>
                    {createdCreds && (
                      <div className="mt-2 p-2 rounded bg-card border border-border text-foreground text-xs font-mono space-y-1">
                        <div><span className="text-muted-foreground">Email:</span> {createdCreds.email}</div>
                        <div><span className="text-muted-foreground">Password:</span> {createdCreds.password}</div>
                        <p className="text-muted-foreground text-[10px] mt-1">Copy these credentials and share them with the client.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Create button */}
                <button
                  onClick={handleCreateUser}
                  disabled={formSending || !formEmail || !formPassword || !isPasswordValid(formPassword)}
                  className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {formSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
