import { supabase } from "@/lib/supabase";

/**
 * For client users, build a Supabase `.or()` filter string that matches
 * appointments by either `company_id` or `"Company Name"`.
 *
 * This fixes the mismatch where user_roles.company_id may not match
 * appointments_new.company_id but does match via company_name.
 *
 * Strategy:
 *   1. Look up the given company_id in `clients` to resolve its company_name.
 *   2. Find ALL `clients` rows with the same company_name (case-insensitive) —
 *      there may be duplicates (e.g. an auto-created `auto_*` row and a
 *      manually-created row) that each hold a slice of the appointment data.
 *   3. Build an OR filter covering every sibling company_id PLUS the literal
 *      `"Company Name"` so that we catch appointments linked by any of them.
 */
export async function getClientAppointmentFilter(companyId: string): Promise<string | null> {
  // Resolve the primary company_name for this company_id.
  const { data: primary } = await supabase
    .from("clients")
    .select("company_name")
    .eq("company_id", companyId)
    .maybeSingle();

  let companyName = primary?.company_name?.trim() ?? null;

  // If the given company_id isn't in `clients`, try interpreting it as a name.
  if (!companyName) {
    const { data: byName } = await supabase
      .from("clients")
      .select("company_name")
      .ilike("company_name", companyId)
      .maybeSingle();
    companyName = byName?.company_name?.trim() ?? null;
  }

  if (!companyName) {
    console.warn("[ClientFilter] No company_name resolved for company_id:", companyId);
    return null;
  }

  // Find ALL client rows sharing this company_name (case-insensitive).
  const { data: siblings } = await supabase
    .from("clients")
    .select("company_id, company_name")
    .ilike("company_name", companyName);

  const siblingIds = new Set<string>([companyId]);
  for (const s of siblings ?? []) {
    if (s.company_id && s.company_name?.toLowerCase().trim() === companyName.toLowerCase()) {
      siblingIds.add(s.company_id);
    }
  }

  const parts: string[] = [];
  for (const id of siblingIds) {
    // IDs are slugs — safe to inline unquoted.
    parts.push(`company_id.eq.${id}`);
  }
  // PostgREST .or() requires column names with spaces/specials to be wrapped
  // in double quotes, and values containing spaces/commas/parens to be wrapped
  // in double quotes with `\"` used to escape any embedded double quotes.
  const quotedValue = `"${companyName.replace(/"/g, '\\"')}"`;
  parts.push(`company_name.eq.${quotedValue}`);

  const filter = parts.join(",");
  console.log(
    `[ClientFilter] Resolved ${siblingIds.size} sibling company_id(s) + name "${companyName}" for user company_id "${companyId}"`
  );
  return filter;
}
