import {
  startOfDay,
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  isAfter,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isWeekend,
  eachDayOfInterval,
  startOfWeek,
} from "date-fns";
import type { WeekRange } from "../types";

/**
 * Count business days (Mon-Fri) between two dates, inclusive.
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (isAfter(start, end)) return 0;

  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

/**
 * Calculate elapsed calendar weeks in a date range (for weekly avg).
 * Minimum 1 to avoid division by zero.
 */
export function getElapsedWeeks(startDate: Date, endDate: Date): number {
  const totalDays = differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate));
  if (totalDays <= 0) return 1;
  return Math.max(Math.ceil(totalDays / 7), 1);
}

/**
 * Generate Mon-Fri working week ranges between two dates.
 * Each week runs Monday to Friday.
 */
export function getBusinessWeeks(startDate: Date, endDate: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  // Start from the Monday of the week containing startDate
  let current = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday

  while (isBefore(current, endDate) || differenceInCalendarDays(endDate, current) >= 0) {
    const weekEnd = addDays(current, 4); // Friday
    weeks.push({
      start: current,
      end: weekEnd,
      label: `${format(current, "MMM d")} – ${format(weekEnd, "MMM d")}`,
    });
    current = addDays(current, 7);
  }

  return weeks;
}

/**
 * Generate monthly ranges between two dates.
 */
export function getMonthRanges(startDate: Date, endDate: Date): WeekRange[] {
  if (isAfter(startDate, endDate)) return [];
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  return months.map((m) => ({
    start: startOfMonth(m),
    end: endOfMonth(m),
    label: format(m, "MMM yyyy"),
  }));
}

/**
 * Check if a date falls within a range (inclusive).
 */
export function isInRange(date: Date, start: Date, end: Date): boolean {
  const d = startOfDay(date);
  return !isBefore(d, startOfDay(start)) && !isAfter(d, startOfDay(end));
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string, fmt: string = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, fmt);
}

/**
 * Get default date range: last 7 days.
 */
export function getDefaultDateRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = addDays(end, -6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * Format date for HTML date input (YYYY-MM-DD).
 */
export function toInputDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
