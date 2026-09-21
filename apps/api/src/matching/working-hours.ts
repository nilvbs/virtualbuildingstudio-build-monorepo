/**
 * Official working-hours math for auto-match response windows.
 * Default: Mon–Fri 09:00–18:00 in the configured IANA timezone.
 */

export type WorkingHoursConfig = {
  timeZone: string;
  /** Inclusive start hour (0–23). */
  startHour: number;
  /** Exclusive end hour (0–23). */
  endHour: number;
  /** JS weekday numbers that count (0=Sun … 6=Sat). */
  workdays: number[];
};

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  timeZone: process.env.AUTO_MATCH_TZ ?? 'America/Chicago',
  startHour: Number(process.env.AUTO_MATCH_WORK_START ?? 9),
  endHour: Number(process.env.AUTO_MATCH_WORK_END ?? 18),
  workdays: [1, 2, 3, 4, 5],
};

const STEP_MS = 60_000;

type ZonedParts = {
  weekday: number;
  hour: number;
  minute: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { weekday: map[weekdayName] ?? 1, hour, minute };
}

export function isWithinWorkingHours(
  date: Date,
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): boolean {
  const { weekday, hour, minute } = zonedParts(date, config.timeZone);
  if (!config.workdays.includes(weekday)) return false;
  const mins = hour * 60 + minute;
  return mins >= config.startHour * 60 && mins < config.endHour * 60;
}

/** True when `date` falls on a configured workday (default Mon–Fri), ignoring clock time. */
export function isStaffInviteWeekday(
  date: Date = new Date(),
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): boolean {
  const { weekday } = zonedParts(date, config.timeZone);
  return config.workdays.includes(weekday);
}

/** Advance wall time until `hours` of working time have elapsed. */
export function addWorkingHours(
  from: Date,
  hours: number,
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): Date {
  let remaining = Math.max(0, hours) * 3_600_000;
  let cursor = new Date(from.getTime());
  const hardStop = from.getTime() + 45 * 24 * 3_600_000;

  while (remaining > 0 && cursor.getTime() < hardStop) {
    if (isWithinWorkingHours(cursor, config)) {
      remaining -= STEP_MS;
    }
    cursor = new Date(cursor.getTime() + STEP_MS);
  }
  return cursor;
}

/** Working milliseconds still available between now and an absolute deadline. */
export function remainingWorkingMs(
  now: Date,
  deadline: Date,
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): number {
  if (now.getTime() >= deadline.getTime()) return 0;
  let ms = 0;
  let cursor = new Date(now.getTime());
  const hardStop = deadline.getTime();
  while (cursor.getTime() < hardStop) {
    if (isWithinWorkingHours(cursor, config)) ms += STEP_MS;
    cursor = new Date(cursor.getTime() + STEP_MS);
  }
  return ms;
}

export function formatWorkingDuration(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
