import { supabase } from "@/lib/supabase";
import type { Appointment, Client } from "@/types";

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
