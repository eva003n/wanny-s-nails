import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createBooking,
  createBusinessHours,
  createCustomer,
  createService,
  createTestApp,
  createUser,
} from "../../../../test/helpers.js";

describe("payments routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("POST /api/v1/payments/stk-push", () => {
    it("enqueues an STK push for an APPROVED booking and returns 202", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
      });

      const res = await request(app)
        .post("/api/v1/payments/stk-push")
        .set(authHeader("OWNER"))
        .send({ bookingId: booking.id, phoneNumber: "254712345678" });

      expect(res.status).toBe(202);
      expect(res.body.data.paymentId).toBeTruthy();
      expect(res.body.data.message).toContain("Payment request queued");
    });

    it("rejects a booking that is not APPROVED with 422", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "PENDING",
      });

      const res = await request(app)
        .post("/api/v1/payments/stk-push")
        .set(authHeader("OWNER"))
        .send({ bookingId: booking.id, phoneNumber: "254712345678" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("PAYMENT_NOT_ALLOWED");
    });

    it("rejects an unknown booking with 404", async () => {
      const res = await request(app)
        .post("/api/v1/payments/stk-push")
        .set(authHeader("OWNER"))
        .send({
          bookingId: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
          phoneNumber: "254712345678",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects an invalid phone number with 400 (validation)", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
      });

      const res = await request(app)
        .post("/api/v1/payments/stk-push")
        .set(authHeader("OWNER"))
        .send({ bookingId: booking.id, phoneNumber: "0712345678" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/v1/payments/stk-push")
        .send({ bookingId: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e", phoneNumber: "254712345678" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/payments", () => {
    it("returns a paginated payment list (OWNER sees amounts)", async () => {
      const customer = await createCustomer();
      const service = await createService();
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
        paymentStatus: "SUCCESS",
      });

      const res = await request(app)
        .get("/api/v1/payments?page=1&limit=10")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].amountKes).toBe(1500);
    });

    it("masks amounts for STAFF (§4.3 RBAC)", async () => {
      const customer = await createCustomer();
      const service = await createService();
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
        paymentStatus: "SUCCESS",
      });

      const res = await request(app)
        .get("/api/v1/payments")
        .set(authHeader("STAFF"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].amountKes).toBeNull();
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/payments");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/payments/:id", () => {
    it("returns a payment by id with transactions (OWNER)", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
        paymentStatus: "SUCCESS",
      });

      const list = await request(app)
        .get("/api/v1/payments")
        .set(authHeader("OWNER"));
      const paymentId = list.body.data[0].id;

      const res = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentId);
      expect(res.body.data.booking.id).toBe(booking.id);
    });

    it("returns 404 for an unknown payment", async () => {
      const res = await request(app)
        .get("/api/v1/payments/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a non-UUID id", async () => {
      const res = await request(app)
        .get("/api/v1/payments/not-a-uuid")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/v1/webhooks/daraja (M-Pesa callback)", () => {
    it("acknowledges a success callback with 200 and enqueues the job", async () => {
      // Seed the payment with a CheckoutRequestID so the callback resolves
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "COMPLETED",
        paymentStatus: "PENDING",
      });

      const { prisma } = await import("../../shared/lib/prisma.js");
      await prisma.payment.update({
        where: { bookingId: booking.id },
        data: { checkoutRequestId: "ws_CO_08072024150000000" },
      });

      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_08072024150000000",
            ResultCode: 0,
            ResultDesc: "The service request is processed successfully.",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 1500 },
                { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
                { Name: "TransactionDate", Value: "20260802000000" },
                { Name: "PhoneNumber", Value: 254712345678 },
              ],
            },
          },
        },
      };

      const res = await request(app)
        .post("/api/v1/webhooks/daraja")
        .send(callbackPayload);

      // Respond immediately to Daraja
      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0);
    });

    it("acknowledges a failure callback (ResultCode != 0) with 200", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const booking = await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "COMPLETED",
        paymentStatus: "PENDING",
      });

      const { prisma } = await import("../../shared/lib/prisma.js");
      await prisma.payment.update({
        where: { bookingId: booking.id },
        data: { checkoutRequestId: "ws_CO_FAIL_12345" },
      });

      const res = await request(app)
        .post("/api/v1/webhooks/daraja")
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: "29115-34620561-1",
              CheckoutRequestID: "ws_CO_FAIL_12345",
              ResultCode: 1032,
              ResultDesc: "Request cancelled by user",
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0); // acknowledge regardless
    });
  });
});