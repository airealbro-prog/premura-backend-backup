import type { Appointment } from "@/types";

/**
 * Check if a record counts as a valid appointment.
 * Valid = created_at exists AND dq_reason is null or empty.
 * We no longer require disposition_date.
 */
export function isValidAppointment(record: Appointment): boolean {
  return !!record.created_at && (!record.dq_reason || record.dq_reason.trim() === "");
}

/**
 * Client Achievement % = (valid appointments) / (seats_purchased x business_days) x 100
 */
export function clientAchievement(
  appointments: number,
  seatsPurchased: number,
  businessDays: number
): number {
  const target = seatsPurchased * businessDays;
  if (target === 0) return 0;
  return (appointments / target) * 100;
}

/**
 * Agent Achievement % = (agent's valid appointments) / (business_days) x 100
 */
export function agentAchievement(
  appointments: number,
  businessDays: number
): number {
  if (businessDays === 0) return 0;
  return (appointments / businessDays) * 100;
}

/**
 * Return the color for an achievement percentage tier.
 */
export function getAchievementColor(percentage: number): string {
  if (percentage >= 60) return "#3b82f6"; // blue — good
  if (percentage >= 30) return "#f59e0b"; // orange — mediocre
  return "#ef4444"; // red — bad
}

/**
 * Return the tier name for an achievement percentage.
 */
export function getAchievementTier(
  percentage: number
): "blue" | "orange" | "red" {
  if (percentage >= 60) return "blue";
  if (percentage >= 30) return "orange";
  return "red";
}

/**
 * Calculate weekly average.
 */
export function weeklyAverage(appointments: number, elapsedWeeks: number): number {
  if (elapsedWeeks === 0) return 0;
  return appointments / elapsedWeeks;
}
