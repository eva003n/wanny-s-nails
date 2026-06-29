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

  // if (existingCustomer) {
  //   // Returning customer — proceed to GREETING as before
  //   return {
  //     messages: [],
  //     sessionUpdates: {
  //       state: "GREETING",
  //       customerId: existingCustomer.id,
  //       customerName: existingCustomer.name,
  //       isNewCustomer: false,
  //       invalidInputCount: 0,
  //       flow: undefined,
  //       selectedService: undefined,
  //       selectedDate: undefined,
  //       selectedTime: undefined,
  //       appointmentAt: undefined,
  //       bookingId: undefined,
  //       bookingRef: undefined,
  //       paymentPhone: undefined,
  //       collectionPhase: undefined,
  //       temporaryName: undefined,
  //       temporaryEmail: undefined,
  //     },
  //     nextState: "GREETING",
  //   };
  // }

  // New customer — transition to DATA_COLLECTION to collect name & email
  return {
    messages: [],
    sessionUpdates: {
      state: "GREETING",
      customerName: existingCustomer?.name ?? "there",
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
