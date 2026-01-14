// Track emails sent in current session for break simulation
let emailsSinceBreak = 0;
let lastBreakTime = Date.now();

// Reset on module load
const BREAK_INTERVAL_MIN = 10;
const BREAK_INTERVAL_MAX = 20;
const BREAK_DURATION_MIN = 2 * 60 * 1000; // 2 minutes
const BREAK_DURATION_MAX = 5 * 60 * 1000; // 5 minutes

function shouldTakeBreak(simulateBreaks: boolean): boolean {
  if (!simulateBreaks) return false;

  // Random interval between 10-20 emails
  const breakAfter = BREAK_INTERVAL_MIN +
    Math.floor(Math.random() * (BREAK_INTERVAL_MAX - BREAK_INTERVAL_MIN));

  return emailsSinceBreak >= breakAfter;
}

function getBreakDuration(): number {
  return BREAK_DURATION_MIN +
    Math.random() * (BREAK_DURATION_MAX - BREAK_DURATION_MIN);
}

export function getRandomDelay(
  minSeconds: number,
  maxSeconds: number,
  simulateBreaks: boolean
): number {
  emailsSinceBreak++;

  // Check if we should take a break
  if (shouldTakeBreak(simulateBreaks)) {
    emailsSinceBreak = 0;
    lastBreakTime = Date.now();
    const breakDuration = getBreakDuration();
    console.log(`[humanize] Taking a ${Math.round(breakDuration / 1000)}s break`);
    return breakDuration;
  }

  // Normal random delay
  const range = maxSeconds - minSeconds;
  const baseDelay = minSeconds + Math.random() * range;

  // Add slight clustering (occasionally send emails closer together)
  // 20% chance to use half the delay
  if (Math.random() < 0.2) {
    return (baseDelay * 0.5) * 1000;
  }

  // 10% chance to add 50% more delay
  if (Math.random() < 0.1) {
    return (baseDelay * 1.5) * 1000;
  }

  return baseDelay * 1000;
}

export function resetHumanization(): void {
  emailsSinceBreak = 0;
  lastBreakTime = Date.now();
}

// Add some variation to timestamps
export function humanizeTimestamp(date: Date, varianceMinutes: number = 5): Date {
  const variance = (Math.random() * 2 - 1) * varianceMinutes * 60 * 1000;
  return new Date(date.getTime() + variance);
}
