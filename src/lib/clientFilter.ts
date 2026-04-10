import { supabase } from "@/lib/supabase";

/**
 * For client users, build a Supabase `.or()` filter string that matches
 * appointments by either `company_id` or `"Company Name"`.
 *
 * This fixes the mismatch where user_roles.company_id may not match
 * appointments_new.company_id but does match via company_name.
 */
export async function getClientAppointmentFilter(companyId: string): Promise<string | null> {
  // Look up the company_name from the clients table
  const { data } = await supabase
    .from("clients")
    .select("company_name")
    .eq("company_id", companyId)
    .maybeSingle();

  const companyName = data?.company_name;

  if (companyName) {
    // Match on either company_id OR "Company Name" (the quoted column in appointments_new)
    return `company_id.eq.${companyId},Company Name.eq.${companyName}`;
  }

  // Fallback: just match on company_id
  return null;
}
