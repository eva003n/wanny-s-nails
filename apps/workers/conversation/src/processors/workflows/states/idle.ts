import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { findCustomerByPhone } from "../helpers.js";

/**
 * IDLE / Session Expired
 *
 * Entry condition: No existing session or TTL expired.
 * Behaviour:
 *  - Returning customer → load customer, transition to GREETING
 *  - New customer (not in DB) → transition to DATA_COLLECTION to collect name & email
 */
export async function handleIdle(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const existingCustomer = await findCustomerByPhone(ctx.phone);

  // All customers transition to greeting (New or existing customers)
  return {
    messages: [],
    sessionUpdates: {
      state: "GREETING",
      customerName: existingCustomer?.name ?? "there",
      customerId: existingCustomer?.id ?? undefined,
      isNewCustomer: existingCustomer == null,
      collectionPhase: undefined,
      invalidInputCount: 0,
      flow: undefined,
      selectedService: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      appointmentAt: undefined,
      bookingId: undefined,
      bookingRef: undefined,
      paymentPhone: undefined,
      temporaryName: undefined,
      temporaryEmail: undefined,
    },
    nextState: "GREETING",
  };
}
