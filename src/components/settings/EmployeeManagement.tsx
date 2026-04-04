import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { UserPermissions } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, Loader2, Check } from "lucide-react";

interface Employee {
  id: string;
  user_id: string;
  role: string;
  permissions: UserPermissions;
  email?: string;
}

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string; defaultOn: boolean }[] = [
  { key: "can_view_overview", label: "Can view Overview", defaultOn: true },
  { key: "can_view_performance", label: "Can view Performance", defaultOn: true },
  { key: "can_view_leaderboard", label: "Can view Leaderboard", defaultOn: true },
  { key: "can_view_historical", label: "Can view Historical", defaultOn: true },
  { key: "can_view_settings", label: "Can view Settings", defaultOn: false },
  { key: "can_view_contacts", label: "Can view contact info", defaultOn: true },
  { key: "can_view_recordings", label: "Can view recordings", defaultOn: true },
  { key: "can_view_credit_scores", label: "Can view credit scores", defaultOn: false },
  { key: "can_view_commissions", label: "Can view commissions", defaultOn: false },
  { key: "can_view_all_clients", label: "Can view all clients", defaultOn: true },
];

function getDefaultPermissions(): UserPermissions {
  return {
    can_view_overview: true,
    can_view_performance: true,
    can_view_leaderboard: true,
    can_view_historical: true,
    can_view_settings: false,
    can_view_contacts: true,
    can_view_recordings: true,
    can_view_credit_scores: false,
    can_view_commissions: false,
    can_view_all_clients: true,
    restricted_client_ids: [],
  };
}

function summarizePermissions(perms: UserPermissions): string {
  const on = PERMISSION_LABELS.filter((p) => perms[p.key] === true).length;
  return `${on}/${PERMISSION_LABELS.length} enabled`;
}

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"backend_employee" | "frontend_employee">("backend_employee");
  const [formPerms, setFormPerms] = useState<UserPermissions>(getDefaultPermissions());

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("id, user_id, role, permissions")
        .in("role", ["backend_employee", "frontend_employee"])
        .order("created_at", { ascending: true });

      if (data) {
        // Fetch emails from auth.users via a Supabase function or just display user_id
        // We store the name in permissions.name
        setEmployees(
          data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            role: d.role,
            permissions: { ...getDefaultPermissions(), ...(d.permissions as Partial<UserPermissions>) },
          }))
        );
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openInviteModal = () => {
    setEditingEmployee(null);
    setFormName("");
    setFormEmail("");
    setFormRole("backend_employee");
    setFormPerms(getDefaultPermissions());
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.permissions.name ?? "");
    setFormEmail("");
    setFormRole(emp.role as "backend_employee" | "frontend_employee");
    setFormPerms({ ...emp.permissions });
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleDelete = async (emp: Employee) => {
    await supabase.from("user_roles").delete().eq("id", emp.id);
    fetchEmployees();
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setFormPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    setSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const permissionsJson = { ...formPerms, name: formName };

    try {
      if (editingEmployee) {
        // Update existing
        const { error } = await supabase
          .from("user_roles")
          .update({
            role: formRole,
            permissions: permissionsJson,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingEmployee.id);

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg("Employee updated successfully.");
          fetchEmployees();
          setTimeout(() => setShowModal(false), 1200);
        }
      } else {
        // Create new user via signUp
        if (!formEmail) {
          setErrorMsg("Email is required.");
          setSending(false);
          return;
        }

        // Generate random temporary password
        const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formEmail,
          password: tempPassword,
        });

        if (signUpError) {
          setErrorMsg(signUpError.message);
          setSending(false);
          return;
        }

        const newUserId = signUpData.user?.id;
        if (!newUserId) {
          setErrorMsg("Failed to create user account.");
          setSending(false);
          return;
        }

        // Insert role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: newUserId,
          role: formRole,
          permissions: permissionsJson,
        });

        if (roleError) {
          setErrorMsg(roleError.message);
        } else {
          setSuccessMsg(`Invitation sent to ${formEmail}`);
          fetchEmployees();
          setTimeout(() => setShowModal(false), 2000);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
    }
    setSending(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Employee Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Invite and manage employee access to the dashboard.
          </p>
        </div>
        <button
          onClick={openInviteModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Invite Employee
        </button>
      </div>

      {/* Employee Table */}
      <div className="glass-card overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 min-w-[700px]">
          <div>Name</div>
          <div>Email / User ID</div>
          <div>Role</div>
          <div>Permissions</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No employees yet. Click "Invite Employee" to add one.
          </div>
        ) : (
          employees.map((emp) => (
            <div
              key={emp.id}
              className="grid grid-cols-5 gap-2 px-4 py-3 items-center border-b border-border min-w-[700px]"
            >
              <div className="text-sm font-medium text-foreground truncate">
                {emp.permissions.name || "—"}
              </div>
              <div className="text-sm text-muted-foreground truncate" title={emp.user_id}>
                {emp.user_id.slice(0, 8)}...
              </div>
              <div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {emp.role === "backend_employee" ? "Backend" : "Frontend"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {summarizePermissions(emp.permissions)}
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => openEditModal(emp)}
                  className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(emp)}
                  className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />

          {/* Modal content */}
          <div className="relative w-full max-w-lg mx-4 rounded-lg border border-border p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                {editingEmployee ? "Edit Employee" : "Invite Employee"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
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

              {/* Email — only for new invite */}
              {!editingEmployee && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="employee@company.com"
                    required
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as typeof formRole)}
                  className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="backend_employee">Backend Employee</option>
                  <option value="frontend_employee">Frontend Employee</option>
                </select>
              </div>

              {/* Permission toggles */}
              <div>
                <label className="block text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                  Permissions
                </label>
                <div className="space-y-2">
                  {PERMISSION_LABELS.map((p) => {
                    const isOn = formPerms[p.key] === true;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePerm(p.key)}
                        className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-border hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-sm text-foreground">{p.label}</span>
                        <div
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            isOn ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              isOn ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Messages */}
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="rounded-md bg-success/10 border border-success/30 px-3 py-2 text-sm text-success flex items-center gap-2">
                  <Check size={14} />
                  {successMsg}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={sending || (!editingEmployee && !formEmail)}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {editingEmployee ? "Saving..." : "Sending..."}
                  </>
                ) : editingEmployee ? (
                  "Save Changes"
                ) : (
                  "Send Invitation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
