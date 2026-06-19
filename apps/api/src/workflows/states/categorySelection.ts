import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { servicesService } from "../../modules/services/services.service.js";
import type { ServiceCategory } from "../types.js";

/**
 * Human-readable labels for each service category.
 */
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE: "💅 Manicure",
  PEDICURE: "🦶 Pedicure",
  OVERLAY: "✨ Overlay",
  ACRYLIC: "💎 Acrylic",
};

/**
 * CATEGORY_SELECTION
 *
 * Fetches distinct active service categories and presents them as
 * an interactive list. Once the user taps one, we save
 * the chosen category to the session and transition to
 * SERVICE_SELECTION which will only list services in that category.
 *
 * Transitions:
 *  valid category → SERVICE_SELECTION (save selectedCategory)
 *  invalid        → stay, increment count
 */
export async function handleCategorySelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const categories = await servicesService.listCategories();

  if (categories.length === 0) {
    return {
      messages: [
        {
          type: "text",
          text: "Sorry, we currently have no services available. Please check back later.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // If we already have a category in session (user is re-entering after invalid input)
  // and input is a number that corresponds to a category, skip re-showing
  const selectedIndex = parseInt(input, 10);

  if (
    !isNaN(selectedIndex) &&
    selectedIndex >= 1 &&
    selectedIndex <= categories.length
  ) {
    const selectedCategory = categories[selectedIndex - 1]!;

    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedCategory: selectedCategory as ServiceCategory,
      },
      nextState: "SERVICE_SELECTION",
    };
  }

  // Invalid input — show category list again
  const newSession = incrementInvalidCount(ctx.session);

  return {
    messages: [buildCategoryListMessage(categories as ServiceCategory[])],
    sessionUpdates: newSession,
    nextState: "CATEGORY_SELECTION",
  };
}

/**
 * Build an interactive list message listing the available categories.
 *
 * We use a list instead of buttons because WhatsApp limits button messages to
 * 3 buttons max, but a salon may have more categories.
 */
function buildCategoryListMessage(
  categories: ServiceCategory[],
): StateTransitionResult["messages"][0] {
  return {
    type: "interactive_list",
    text: "What type of service are you looking for?",
    listTitle: "Service Categories",
    listButtonText: "Pick a category",
    listSections: [
      {
        title: "Categories",
        rows: categories.map((cat, i) => ({
          id: String(i + 1),
          title: CATEGORY_LABELS[cat] ?? cat,
        })),
      },
    ],
  };
}
