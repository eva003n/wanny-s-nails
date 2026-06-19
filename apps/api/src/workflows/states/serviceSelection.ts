import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { servicesService } from "../../modules/services/services.service.js";
import { truncateTitle } from "../helpers.js";
import type { ServiceCategory } from "../types.js";

/**
 * Human-readable labels for categories (shown in the list header).
 */
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE: "Manicure",
  PEDICURE: "Pedicure",
  OVERLAY: "Overlay",
  ACRYLIC: "Acrylic",
};

/**
 * Build the service selection interactive list message for a specific category.
 */
function buildServiceListMessage(
  services: Array<{ name: string; priceKes: number; durationMinutes: number }>,
  categoryLabel: string,
): StateTransitionResult["messages"][0] {
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
          description: `KES ${s.priceKes.toLocaleString()} — ${s.durationMinutes} min`,
        })),
      },
    ],
  };
}

/**
 * SERVICE_SELECTION
 *
 * If a category is set in the session, fetches active services for that
 * category and presents them as an interactive list. If no category is
 * set, redirects to CATEGORY_SELECTION.
 *
 * The user can type "back" to return to category selection.
 *
 * Transitions:
 *  valid number (1-N) → DATE_SELECTION (save selected service)
 *  "back"            → CATEGORY_SELECTION
 *  invalid            → stay, increment count
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

  // Fetch active services for the chosen category
  const services = await servicesService.listByCategory(category);

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
  if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > services.length) {
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