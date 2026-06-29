import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { prisma } from "../../../lib/prisma.js";
import { truncateTitle } from "../helpers.js";
import type { ServiceCategory } from "../types.js";

/** WhatsApp interactive list max rows */
const MAX_LIST_ROWS = 10;

/**
 * Human-readable labels for categories (shown in the list header).
 */
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE: "\u{1F485} Manicure",
  PEDICURE: "\u{1F9B6} Pedicure",
  ENHANCEMENTS: "\u2728 Enhancements",
  NAIL_ART: "\u{1F3A8} Nail Art",
  EXTENSIONS: "\u{1F4CF} Extensions",
  REMOVAL: "\u{1F9F9} Removal",
  REPAIR: "\u{1F527} Repair",
  TREATMENT: "\u{1F33F} Treatment",
};

/**
 * Build the description line for a service row.
 * Uses the DB description when available, otherwise falls back to price + duration.
 */
function buildServiceDescription(
  service: { description?: string | null; priceKes: number; durationMinutes: number },
): string {
  const priceDuration = `KES ${service.priceKes.toLocaleString()} \u2014 ${service.durationMinutes} min`;
  if (service.description) {
    return `${service.description} | ${priceDuration}`;
  }
  return priceDuration;
}

/**
 * Build the service selection message for a specific category.
 * Uses interactive list when services fit within WhatsApp's 10-row limit,
 * otherwise falls back to a text-based numbered list.
 * Includes the DB description for each service.
 */
function buildServiceListMessage(
  services: Array<{ name: string; description?: string | null; priceKes: number; durationMinutes: number }>,
  categoryLabel: string,
): StateTransitionResult["messages"][0] {
  if (services.length <= MAX_LIST_ROWS) {
    return {
      type: "interactive_list",
      text: `Which ${categoryLabel} service would you like?`,
      listTitle: `${categoryLabel} Services`,
      listButtonText: "Choose a service",
      listSections: [
        {
          title: "Available Services",
          rows: services.map((s, i) => ({
            id: String(i + 1),
            title: truncateTitle(s.name),
            description: buildServiceDescription(s),
          })),
        },
      ],
    };
  }

  // Too many services for an interactive list — send a numbered text message
  const lines = services.map(
    (s, i) =>
      `${i + 1}. ${s.name}\n   ${s.description ? s.description + " \u2014 " : ""}KES ${s.priceKes.toLocaleString()} (${s.durationMinutes} min)`,
  );
  return {
    type: "text",
    text: `Which ${categoryLabel} service would you like?\n\n${lines.join("\n\n")}\n\nReply with a number to pick a service.`,
  };
}

/**
 * SERVICE_SELECTION
 *
 * If a category is set in the session, fetches active services for that
 * category from the DB and presents them as an interactive list.
 * If no category is set, redirects to CATEGORY_SELECTION.
 *
 * Each service row includes its DB description to help the customer choose.
 *
 * The user can type "back" to return to category selection.
 *
 * Transitions:
 *  valid number (1-N) \u2192 DATE_SELECTION (save selected service)
 *  "back"            \u2192 CATEGORY_SELECTION
 *  invalid            \u2192 stay, increment count
 */
export async function handleServiceSelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();

  // Allow the user to go back to category selection
  if (input === "back") {
    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedCategory: undefined,
      },
      nextState: "CATEGORY_SELECTION",
    };
  }

  // If no category selected, redirect to category selection
  if (!ctx.session.selectedCategory) {
    return {
      messages: [],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "CATEGORY_SELECTION",
    };
  }

  const category = ctx.session.selectedCategory;
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  // Fetch active services for the chosen category from the DB
  const services = await prisma.nailService.findMany({
    where: { category: category as any, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  if (services.length === 0) {
    // No services in this category — go back to category selection
    return {
      messages: [
        {
          type: "text",
          text: `Sorry, there are no ${categoryLabel} services available right now. Let's pick a different category.`,
        },
      ],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedCategory: undefined,
      },
      nextState: "CATEGORY_SELECTION",
    };
  }

  const selectedIndex = parseInt(input, 10);

  // Validate selection
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 1 ||
    selectedIndex > services.length
  ) {
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [buildServiceListMessage(services, categoryLabel)],
      sessionUpdates: newSession,
      nextState: "SERVICE_SELECTION",
    };
  }

  const selected = services[selectedIndex - 1]!;

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedService: {
        id: selected.id,
        name: selected.name,
        durationMinutes: selected.durationMinutes,
        priceKes: selected.priceKes,
      },
    },
    nextState: "DATE_SELECTION",
  };
}