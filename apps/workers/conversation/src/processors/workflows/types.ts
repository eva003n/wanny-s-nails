// ─── Conversation States ───
import type { Message } from "@wannys-nails/packages";
export type ConversationState =
  | "IDLE"
  | "GREETING"
  | "DATA_COLLECTION"
  | "CATEGORY_SELECTION"
  | "SERVICE_SELECTION"
  | "DATE_SELECTION"
  | "TIME_PERIOD_SELECTION"
  | "TIME_SELECTION"
  | "BOOKING_CONFIRMATION"
  | "AWAITING_PAYMENT_PHONE"
  | "AWAITING_PAYMENT"
  | "THANK_YOU"
  | "RESCHEDULE_DATE"
  | "RESCHEDULE_TIME"
  | "RESCHEDULE_CONFIRMATION"
  | "CANCEL_CONFIRMATION"
  | "HUMAN_ESCALATION";

export type FlowType = "BOOKING" | "RESCHEDULE" | "CANCEL" | "LOOKUP";

// ─── Service Categories (mirrors Prisma enum) ───

export type ServiceCategory =
  | "MANICURE"
  | "PEDICURE"
  | "ENHANCEMENTS"
  | "NAIL_ART"
  | "EXTENSIONS"
  | "REMOVAL"
  | "REPAIR"
  | "TREATMENT";



// ─── Session ───

export interface ConversationSession {
  state: ConversationState;
  customerId?: string | undefined;
  customerName?:string | undefined;
  customerPhone?: string | undefined;
  selectedService?:
    | {
        id: string;
        name: string;
        durationMinutes: number;
        priceKes: number;
      }
    | undefined;
  selectedDate?: string | undefined; // "2025-06-05" (EAT)
  selectedTime?: string | undefined; // "14:00" (EAT)
  appointmentAt?: string | undefined; // ISO UTC (computed after date+time selected)
  bookingId?: string | undefined;
  // bookings?: Booking[] | undefined
  bookingRef?: string | undefined;
  paymentPhone?: string | undefined;
  /** Selected time period preference — set during TIME_PERIOD_SELECTION */
  selectedTimePeriod?: "morning" | "afternoon" | "evening" | undefined;
  /** Selected service category filter — set during CATEGORY_SELECTION */
  selectedCategory?: ServiceCategory | undefined;
  /** Current page offset for paginated time slot selection (0-based) */
  slotPage?: number | undefined;
  /** Sub-phase within DATA_COLLECTION: "NAME" (collecting name) */
  collectionPhase?: "NAME" | undefined;
  /** Temp name stored during DATA_COLLECTION before DB record is created */
  temporaryName?: string | undefined;
  /** Temp email stored during DATA_COLLECTION before DB record is created */
  temporaryEmail?: string | undefined;
  /** Whether the customer is new (not yet in DB) — set by IDLE handler */
  isNewCustomer?: boolean | undefined;
  invalidInputCount: number;
  lastActivity: string; // ISO UTC
  flow?: FlowType | undefined;
}

// ─── State Handler Return ───

export interface StateTransitionResult {
  /** Outbound WhatsApp messages to send (in order) */
  messages: Message[];
  /** Session updates to persist */
  sessionUpdates: Partial<ConversationSession>;
  /** New state to transition to (undefined = keep current) */
  nextState?: ConversationState;
}



// ─── State Handler Signature ───

export interface StateHandlerContext {
  /** Parsed incoming message body (trimmed, lowercase where appropriate) */
  message: string;
  /** Raw incoming message body */
  rawMessage: string;
  /** Current conversation session */
  session: ConversationSession;
  /** Phone number (currently stored as 254XXXXXXXXX, without leading +) */
  phone: string;
}

// ─── Date Slot (for DATE_SELECTION menu) ───

export interface DateOption {
  label: string; // e.g. "Today (Thu 5 Jun)"
  date: string; // "2025-06-05"
  availableSlots: number;
  isFull: boolean;
}

export type Slot = {
  time: string;
  available: boolean;
  appointmentAt: string;
}