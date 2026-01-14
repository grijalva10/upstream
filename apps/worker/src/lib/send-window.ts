import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, isWeekend, getDay } from 'date-fns';

interface HumanizeOptions {
  min: number; // minutes before window start
  max: number; // minutes after window start
}

// Cache for daily jitter (reset each day)
const dailyJitterCache: Record<string, number> = {};

function getDailyJitter(timezone: string, options?: HumanizeOptions): number {
  if (!options) return 0;

  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const dateKey = `${zonedNow.getFullYear()}-${zonedNow.getMonth()}-${zonedNow.getDate()}`;

  if (!dailyJitterCache[dateKey]) {
    // Generate random jitter for today
    const range = options.max - options.min;
    dailyJitterCache[dateKey] = options.min + Math.random() * range;

    // Clean old entries
    const keys = Object.keys(dailyJitterCache);
    if (keys.length > 7) {
      delete dailyJitterCache[keys[0]];
    }
  }

  return dailyJitterCache[dateKey];
}

export function isWithinSendWindow(
  windowStart: string,
  windowEnd: string,
  timezone: string,
  weekdaysOnly: boolean,
  humanizeOptions?: HumanizeOptions
): boolean {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);

  // Check weekday requirement
  if (weekdaysOnly && isWeekend(zonedNow)) {
    return false;
  }

  // Parse window times
  const [startHour, startMinute] = windowStart.split(':').map(Number);
  const [endHour, endMinute] = windowEnd.split(':').map(Number);

  // Apply humanization jitter to start time
  const jitterMinutes = getDailyJitter(timezone, humanizeOptions);
  const adjustedStartHour = startHour;
  const adjustedStartMinute = startMinute + jitterMinutes;

  // Convert to minutes since midnight for comparison
  const currentMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();
  const startMinutes = adjustedStartHour * 60 + adjustedStartMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function getNextWindowStart(
  windowStart: string,
  timezone: string,
  weekdaysOnly: boolean
): Date {
  const now = new Date();
  let next = toZonedTime(now, timezone);

  // Parse window start time
  const [startHour, startMinute] = windowStart.split(':').map(Number);

  // Set to start of send window
  next = setHours(next, startHour);
  next = setMinutes(next, startMinute);
  next = setSeconds(next, 0);

  // If we're past today's window, move to tomorrow
  const zonedNow = toZonedTime(now, timezone);
  if (zonedNow >= next) {
    next = addDays(next, 1);
  }

  // Skip weekends if required
  if (weekdaysOnly) {
    while (isWeekend(next)) {
      next = addDays(next, 1);
    }
  }

  // Convert back to UTC
  return fromZonedTime(next, timezone);
}

export function getWindowEndToday(
  windowEnd: string,
  timezone: string
): Date {
  const now = new Date();
  let end = toZonedTime(now, timezone);

  const [endHour, endMinute] = windowEnd.split(':').map(Number);

  end = setHours(end, endHour);
  end = setMinutes(end, endMinute);
  end = setSeconds(end, 0);

  return fromZonedTime(end, timezone);
}

export function getTimeUntilWindowEnd(
  windowEnd: string,
  timezone: string
): number {
  const now = new Date();
  const end = getWindowEndToday(windowEnd, timezone);
  return Math.max(0, end.getTime() - now.getTime());
}
