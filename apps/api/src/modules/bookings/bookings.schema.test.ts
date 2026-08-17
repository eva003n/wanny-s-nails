import { describe, expect, it } from "vitest";
import {
  createBookingSchema,
  cancelSchema,
  rescheduleSchema,
  markPaidSchema,
  patchNotesSchema,
  uuidParamSchema,
  listBookingsQuerySchema,
} from "./bookings.controller.js";

const VALID_UUID = "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e";

describe("bookings — schema validation (TESTING.md §4.2)", () => {
  describe("createBookingSchema", () => {
    it("accepts a valid multi-service booking payload", () => {
      const result = createBookingSchema.safeParse({
        customerId: VALID_UUID,
        serviceIds: [VALID_UUID, VALID_UUID],
        appointmentAt: "2026-08-01T09:00:00.000Z",
        notes: "Please bring inspo pics",
        stylist: "Grace",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a payload with no notes/stylist", () => {
      const result = createBookingSchema.safeParse({
        customerId: VALID_UUID,
        serviceIds: [VALID_UUID],
        appointmentAt: "2026-08-01T09:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-UUID customerId", () => {
      const result = createBookingSchema.safeParse({
        customerId: "not-a-uuid",
        serviceIds: [VALID_UUID],
        appointmentAt: "2026-08-01T09:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty serviceIds array", () => {
      const result = createBookingSchema.safeParse({
        customerId: VALID_UUID,
        serviceIds: [],
        appointmentAt: "2026-08-01T09:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-datetime appointmentAt", () => {
      const result = createBookingSchema.safeParse({
        customerId: VALID_UUID,
        serviceIds: [VALID_UUID],
        appointmentAt: "tomorrow",
      });
      expect(result.success).toBe(false);
    });

    it("rejects notes longer than 500 chars", () => {
      const result = createBookingSchema.safeParse({
        customerId: VALID_UUID,
        serviceIds: [VALID_UUID],
        appointmentAt: "2026-08-01T09:00:00.000Z",
        notes: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("cancelSchema", () => {
    it("accepts an empty body", () => {
      const result = cancelSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts an optional reason", () => {
      const result = cancelSchema.safeParse({ reason: "Client busy" });
      expect(result.success).toBe(true);
    });

    it("rejects a reason longer than 255 chars", () => {
      const result = cancelSchema.safeParse({ reason: "x".repeat(256) });
      expect(result.success).toBe(false);
    });
  });

  describe("rescheduleSchema", () => {
    it("accepts a valid new datetime", () => {
      const result = rescheduleSchema.safeParse({
        appointmentAt: "2026-08-02T14:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing appointmentAt", () => {
      const result = rescheduleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects a non-datetime appointmentAt", () => {
      const result = rescheduleSchema.safeParse({
        appointmentAt: "next tuesday",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("markPaidSchema", () => {
    it("accepts CASH method", () => {
      const result = markPaidSchema.safeParse({ method: "CASH" });
      expect(result.success).toBe(true);
    });

    it("rejects a non-CASH method", () => {
      const result = markPaidSchema.safeParse({ method: "MPESA" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing method", () => {
      const result = markPaidSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("patchNotesSchema", () => {
    it("accepts a string", () => {
      const result = patchNotesSchema.safeParse({ notes: "Client prefers gel" });
      expect(result.success).toBe(true);
    });

    it("accepts null", () => {
      const result = patchNotesSchema.safeParse({ notes: null });
      expect(result.success).toBe(true);
    });

    it("rejects notes longer than 500 chars", () => {
      const result = patchNotesSchema.safeParse({ notes: "x".repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe("uuidParamSchema", () => {
    it("accepts a valid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: "123" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing id", () => {
      const result = uuidParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("listBookingsQuerySchema", () => {
    it("accepts valid pagination + filters", () => {
      const result = listBookingsQuerySchema.safeParse({
        page: "2",
        limit: "25",
        status: "APPROVED",
        customerId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("accepts an empty query", () => {
      const result = listBookingsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects a non-numeric page", () => {
      const result = listBookingsQuerySchema.safeParse({ page: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects a negative limit", () => {
      const result = listBookingsQuerySchema.safeParse({ limit: "-5" });
      expect(result.success).toBe(false);
    });

    it("rejects a limit greater than 100", () => {
      const result = listBookingsQuerySchema.safeParse({ limit: "101" });
      expect(result.success).toBe(false);
    });
  });
});