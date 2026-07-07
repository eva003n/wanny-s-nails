/**
 * Recommendation Engine
 *
 * Pure filter/rank functions for available time slots.
 * This engine NEVER generates availability — it only filters, groups, and ranks
 * slots produced by the Availability Engine (getAvailableSlots).
 *
 * Future strategies (customer preferences, technician preferences, least busy
 * periods, AI ranking, etc.) can be added by implementing a new strategy
 * function and registering it in the `strategies` map.
 */

// ─── Time Period Types ───

export type TimePeriod = "morning" | "afternoon" | "evening";

export interface TimePeriodRange {
  label: string;
  emoji: string;
  startHour: number; // inclusive
  endHour: number; // exclusive
}

export const TIME_PERIODS: Record<TimePeriod, TimePeriodRange> = {
  morning: {
    label: "Morning",
    emoji: "🌅",
    startHour: 7,
    endHour: 12, // 07:00 – 11:59
  },
  afternoon: {
    label: "Afternoon",
    emoji: "☀️",
    startHour: 12,
    endHour: 17, // 12:00 – 16:59
  },
  evening: {
    label: "Evening",
    emoji: "🌙",
    startHour: 17,
    endHour: 20, // 17:00 – 19:00 (endHour exclusive = 20)
  },
};

// ─── Slot Type ───

/**
 * Minimal slot shape the Recommendation Engine works with.
 * Accepts any object with at least `time` and `appointmentAt`,
 * making it compatible with both the Availability Engine's Slot
 * and the FSM's simpler slot representation.
 */
export interface SlotLike {
  time: string;
  appointmentAt: string;
}

// ─── Strategy Types ───

export type RecommendationStrategy = "time_of_day";

export interface RecommendationInput {
  /** Available slots from the Availability Engine */
  slots: SlotLike[];
  /** Preferred time period */
  timePeriod: TimePeriod;
  /** Maximum number of slots to return (default 10) */
  maxResults?: number;
  /** Strategy to use (default "time_of_day") */
  strategy?: RecommendationStrategy;
}

export interface RecommendationResult {
  /** Filtered and ranked slots */
  slots: SlotLike[];
  /** The time period that was applied */
  timePeriod: TimePeriod;
  /** Total available slots in this period before limiting */
  totalInPeriod: number;
  /** Whether the result was truncated by maxResults */
  truncated: boolean;
}

// ─── Time-of-Day Strategy ───

/**
 * Filter slots by time period, sort chronologically, and limit results.
 *
 * This is the default strategy. It groups slots into three time-of-day
 * categories and returns the ones matching the requested period.
 */
function timeOfDayStrategy(input: RecommendationInput): RecommendationResult {
  const { slots, timePeriod, maxResults = 10 } = input;
  const period = TIME_PERIODS[timePeriod];

  // Filter slots whose hour falls within the period range
  const filtered = slots.filter((slot) => {
    const hour = parseInt(slot.time.split(":")[0]!, 10);
    return hour >= period.startHour && hour < period.endHour;
  });

  // Shuffle randomly so customers see a different set of times each time.
  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const totalInPeriod = shuffled.length;
  const truncated = totalInPeriod > maxResults;
  const limited = shuffled.slice(0, maxResults);

  return {
    slots: limited,
    timePeriod,
    totalInPeriod,
    truncated,
  };
}

// ─── Strategy Registry ───

const strategies: Record<RecommendationStrategy, typeof timeOfDayStrategy> = {
  time_of_day: timeOfDayStrategy,
};

// ─── Public API ───

/**
 * Get recommended slots based on the specified strategy.
 *
 * @param input - Recommendation input parameters
 * @returns Filtered, ranked, and limited slot results
 *
 * @example
 * ```ts
 * const result = getRecommendedSlots({
 *   slots: availableSlots,
 *   timePeriod: "morning",
 *   maxResults: 5,
 * });
 * ```
 */
export function getRecommendedSlots(
  input: RecommendationInput,
): RecommendationResult {
  const strategy = input.strategy ?? "time_of_day";
  const fn = strategies[strategy];

  if (!fn) {
    throw new Error(`Unknown recommendation strategy: ${strategy}`);
  }

  return fn(input);
}

/**
 * Get the display label for a time period.
 */
export function getTimePeriodLabel(period: TimePeriod): string {
  const p = TIME_PERIODS[period];
  return `${p.emoji} ${p.label} (${formatHour(p.startHour)} – ${formatHour(p.endHour - 1)})`;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:00 ${period}`;
}