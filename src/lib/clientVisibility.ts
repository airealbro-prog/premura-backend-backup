/**
 * Shared client-visibility / metric-eligibility rules.
 *
 * Two concerns, kept separate:
 *   1. isTestClient    — internal test accounts (ZTEST*, Test Solar, …) that must
 *                        never appear in staff-facing reporting. Driven by the
 *                        `clients.is_test` flag, with a ZTEST* name-pattern
 *                        fallback so a freshly-created, un-flagged test row is
 *                        still caught.
 *   2. countsTowardPerformance — whether a client should feed the aggregate
 *                        Call Center Performance / achievement metric. A client
 *                        only counts if it's a real, active, *launched* campaign
 *                        with actual activity in the period (≥1 valid appt).
 *                        Churned / paused / not-launched / zero-appointment rows
 *                        are excluded so they stop dragging the % toward 0.
 */

type TestableClient = { company_name?: string | null; is_test?: boolean | null };

/** True for internal test accounts that must be hidden from staff reporting. */
export function isTestClient(c: TestableClient): boolean {
  if (c.is_test === true) return true;
  // Fallback: catch any un-flagged ZTEST* rows by name.
  return /^\s*ztest\b/i.test(c.company_name ?? "");
}

/** Convenience: drop test accounts from a list of clients. */
export function excludeTestClients<T extends TestableClient>(clients: T[]): T[] {
  return clients.filter((c) => !isTestClient(c));
}

type EligibleClient = {
  status?: string | null;
  company_name?: string | null;
  is_test?: boolean | null;
};

/**
 * Whether a client should be counted in the aggregate Call Center Performance /
 * achievement metric (numerator AND denominator) and the Campaign Health rollup.
 *
 * Rule (confirmed with Ryan): active + non-test + launched-with-activity, where
 * "launched/active" is defined as having ≥1 valid appointment in the period.
 * This excludes churned clients, not-launched/newly-onboarded clients, and
 * launched-but-dormant clients (the "0/X · no appts yet" rows).
 *
 * @param validAppointmentsInRange count of the client's valid appointments
 *        within the currently-selected date range.
 */
export function countsTowardPerformance(
  client: EligibleClient,
  validAppointmentsInRange: number
): boolean {
  if (isTestClient(client)) return false;
  if (client.status !== "active") return false; // excludes churned + paused
  return validAppointmentsInRange > 0; // launched + actually active in the period
}
