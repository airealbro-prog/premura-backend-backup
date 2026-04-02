import type { Appointment, Client } from "../types";

/**
 * Build a function that resolves which Client an Appointment belongs to.
 * Tries company_id first, then falls back to matching the appointment's
 * "Company Name" field against the client's company_name.
 */
export function buildClientMatcher(clients: Client[]) {
  const byId = new Map<string, Client>();
  const byName = new Map<string, Client>();

  for (const c of clients) {
    byId.set(c.company_id, c);
    // Use lower-cased trimmed name for fuzzy matching
    byName.set(c.company_name.toLowerCase().trim(), c);
  }

  return function matchClient(appt: Appointment): Client | undefined {
    // Try exact company_id match first
    if (appt.company_id) {
      const match = byId.get(appt.company_id);
      if (match) return match;
    }
    // Fallback: match "Company Name" field to client's company_name
    const companyName = appt["Company Name"];
    if (companyName) {
      const match = byName.get(companyName.toLowerCase().trim());
      if (match) return match;
    }
    return undefined;
  };
}

/**
 * Group appointments by their resolved client's company_id.
 * Returns a Map keyed by company_id, plus an array of unmatched appointments.
 */
export function groupAppointmentsByClient(
  appointments: Appointment[],
  clients: Client[]
): { groups: Map<string, Appointment[]>; unmatched: Appointment[] } {
  const matcher = buildClientMatcher(clients);
  const groups = new Map<string, Appointment[]>();
  const unmatched: Appointment[] = [];

  // Initialize all client groups
  for (const c of clients) {
    groups.set(c.company_id, []);
  }

  for (const appt of appointments) {
    const client = matcher(appt);
    if (client) {
      groups.get(client.company_id)!.push(appt);
    } else {
      unmatched.push(appt);
    }
  }

  return { groups, unmatched };
}
