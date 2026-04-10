import { supabase } from "@/lib/supabase";
import type { Appointment, Client } from "@/types";

/**
 * After creating or editing a `clients` row, call this to relink any
 * `appointments_new` rows whose "Company Name" matches this client's
 * company_name so their `company_id` is kept in sync. This prevents
 * stale/auto_* ids from leaving appointments orphaned from the client.
 *
 * Returns the number of appointments updated (or -1 on error).
 */
export async function relinkAppointmentsToClient(
  companyId: string,
  companyName: string
): Promise<number> {
  const trimmedName = companyName.trim();
  if (!companyId || !trimmedName) return 0;

  try {
    const { data, error } = await supabase
      .from("appointments_new")
      .update({ company_id: companyId })
      .ilike("Company Name", trimmedName)
      .neq("company_id", companyId)
      .select("id");

    if (error) {
      console.warn("[ClientSync] relinkAppointmentsToClient failed:", error.message);
      return -1;
    }
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`[ClientSync] Relinked ${count} appointments to "${trimmedName}" (${companyId})`);
    }
    return count;
  } catch (err) {
    console.warn("[ClientSync] relinkAppointmentsToClient exception:", err);
    return -1;
  }
}

/**
 * After creating/editing a client row, detect and remove any stale
 * duplicate `clients` rows that share the same company_name.
 * Also redirects any `user_roles` pointing at the duplicate.
 */
export async function mergeDuplicateClients(
  keepCompanyId: string,
  companyName: string
): Promise<number> {
  const trimmedName = companyName.trim();
  if (!keepCompanyId || !trimmedName) return 0;

  try {
    const { data: dupes, error } = await supabase
      .from("clients")
      .select("company_id, company_name")
      .ilike("company_name", trimmedName)
      .neq("company_id", keepCompanyId);

    if (error || !dupes || dupes.length === 0) return 0;

    const dupeIds = dupes
      .filter((d) => d.company_name?.toLowerCase().trim() === trimmedName.toLowerCase())
      .map((d) => d.company_id);

    if (dupeIds.length === 0) return 0;

    // Redirect user_roles
    for (const id of dupeIds) {
      await supabase
        .from("user_roles")
        .update({ company_id: keepCompanyId })
        .eq("company_id", id);
    }

    // Redirect appointments
    for (const id of dupeIds) {
      await supabase
        .from("appointments_new")
        .update({ company_id: keepCompanyId })
        .eq("company_id", id);
    }

    // Delete duplicate client rows
    const { error: delErr } = await supabase
      .from("clients")
      .delete()
      .in("company_id", dupeIds);

    if (delErr) {
      console.warn("[ClientSync] mergeDuplicateClients delete failed:", delErr.message);
      return 0;
    }

    console.log(`[ClientSync] Merged ${dupeIds.length} duplicate client(s) into "${trimmedName}" (${keepCompanyId})`);
    return dupeIds.length;
  } catch (err) {
    console.warn("[ClientSync] mergeDuplicateClients exception:", err);
    return 0;
  }
}

/**
 * Finds companies in appointments that don't have a matching client record,
 * and auto-creates minimal client entries for them.
 * Only runs for admin users (requires insert permission on clients).
 * Returns the number of newly created clients.
 */
export async function syncClientsFromAppointments(
  appointments: Appointment[],
  existingClients: Client[]
): Promise<number> {
  // Build a set of existing client names (lowercase for matching)
  const existingNames = new Set(
    existingClients.map((c) => c.company_name.toLowerCase().trim())
  );
  const existingIds = new Set(
    existingClients.map((c) => c.company_id)
  );

  // Find unique company names from appointments that don't have a client
  const missingCompanies = new Map<string, string>(); // normalized -> original
  for (const appt of appointments) {
    // Skip if appointment already linked to a known client
    if (appt.company_id && existingIds.has(appt.company_id)) continue;

    const name = appt["Company Name"]?.trim();
    if (!name) continue;

    const normalized = name.toLowerCase();
    if (existingNames.has(normalized)) continue;
    if (missingCompanies.has(normalized)) continue;

    missingCompanies.set(normalized, name);
  }

  if (missingCompanies.size === 0) return 0;

  // Generate company_id slugs and insert
  const newClients = Array.from(missingCompanies.values()).map((name) => {
    const slug = "auto_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");
    return {
      company_id: slug,
      company_name: name,
      seats_purchased: 1,
      seats_active: 0,
      status: "active" as const,
    };
  });

  // Deduplicate slugs (in case two different names produce the same slug)
  const seenSlugs = new Set<string>();
  const deduped = newClients.filter((c) => {
    if (seenSlugs.has(c.company_id) || existingIds.has(c.company_id)) return false;
    seenSlugs.add(c.company_id);
    return true;
  });

  if (deduped.length === 0) return 0;

  // Insert in small batches to avoid conflicts
  let created = 0;
  for (const client of deduped) {
    const { error } = await supabase.from("clients").insert(client);
    if (!error) {
      created++;
      console.log(`[ClientSync] Auto-created client: ${client.company_name} (${client.company_id})`);
    } else if (error.code === "23505") {
      // Unique violation — slug already exists, skip
      console.warn(`[ClientSync] Slug conflict for ${client.company_name}, skipping`);
    } else {
      console.warn(`[ClientSync] Failed to create client ${client.company_name}:`, error.message);
    }
  }

  return created;
}
