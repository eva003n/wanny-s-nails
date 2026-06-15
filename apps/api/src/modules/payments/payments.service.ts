import axios from "axios";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/lib/prisma.js";
import { config } from "../../shared/lib/config.js";
import { logger } from "../../shared/lib/logger.js";

const log = logger.child({ module: "payments" });
import { PaymentFailedError, PaymentNotAllowedError, NotFoundError } from "../../shared/types/errors.js";
import { parsePagination } from "../../shared/utils/pagination.js";

interface DarajaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export const paymentsService = {
  async initiateStkPush(bookingId: string, phoneNumber: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new NotFoundError("Booking");
    }

    if (booking.status !== "APPROVED") {
      throw new PaymentNotAllowedError("Booking must be in APPROVED status to initiate payment");
    }

    if (booking.payment?.status === "PAID" || booking.payment?.status === "REFUNDED") {
      throw new PaymentNotAllowedError("Booking already has a completed payment");
    }

    const amount = booking.priceKes;
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);

    const response = await axios.post<DarajaSTKPushResponse>(
      config.DARAJA_STK_PUSH_URL,
      {
        BusinessShortCode: config.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: config.DARAJA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: config.DARAJA_CALLBACK_URL,
        AccountReference: booking.reference,
        TransactionDesc: "Booking payment",
      },
      {
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
      }
    );

    const { CheckoutRequestID, ResponseCode } = response.data;

    if (ResponseCode !== "0") {
      throw new PaymentFailedError(Number(ResponseCode));
    }

    // Update payment record
    const payment = await prisma.payment.update({
      where: { bookingId },
      data: {
        checkoutRequestId: CheckoutRequestID,
        status: "PAYMENT_PENDING",
        phoneNumber,
      },
    });

    // Log the transaction attempt
    const attemptCount = await prisma.paymentTransaction.count({
      where: { paymentId: payment.id },
    });

    await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        attemptNumber: attemptCount + 1,
        checkoutRequestId: CheckoutRequestID,
        rawRequest: { MerchantRequestID: response.data.MerchantRequestID, CheckoutRequestID } as unknown as Record<string, string>,
      },
    });

    return {
      paymentId: payment.id,
      checkoutRequestId: CheckoutRequestID,
      message: `Payment request sent to ${phoneNumber}. Awaiting customer approval.`,
    };
  },

  async list(params: {
    page: number;
    limit: number;
    status: string | undefined;
    from: string | undefined;
    to: string | undefined;
    customerId: string | undefined;
  }) {
    const { page, limit, status, from, to, customerId } = params;
    const skip = (page - 1) * limit;

    const bookingWhere: Record<string, unknown> = {};
    const paymentWhere: Record<string, unknown> = {};

    if (status) {
      paymentWhere.status = status;
    }

    if (customerId) {
      bookingWhere.customerId = customerId;
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      bookingWhere.appointmentAt = dateFilter;
    }

    const hasBookingFilter = Object.keys(bookingWhere).length > 0;
    const paymentWhereClause: Record<string, unknown> = { ...paymentWhere };
    if (hasBookingFilter) {
      paymentWhereClause.booking = bookingWhere;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: paymentWhereClause,
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              appointmentAt: true,
              customer: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: paymentWhereClause }),
    ]);

    return { payments, total, page, limit };
  },

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "asc" },
        },
        booking: {
          select: {
            id: true,
            reference: true,
            customer: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError("Payment");
    }

    return payment;
  },

  async getByBookingId(bookingId: string) {
    return prisma.payment.findUnique({
      where: { bookingId },
      include: { transactions: true },
    });
  },

  async handleCallback(callbackBody: Record<string, unknown>) {
    const body = callbackBody as { Body?: { stkCallback?: Record<string, unknown> } };
    const stkCallback = body.Body?.stkCallback ?? {};
    const checkoutRequestId = stkCallback.CheckoutRequestID as string;
    const resultCode = stkCallback.ResultCode as number;
    const resultDesc = stkCallback.ResultDesc as string;

    const payment = await prisma.payment.findUnique({
      where: { checkoutRequestId },
    });

    if (!payment) {
      log.warn({ event: "payment.callback.not_found", checkoutRequestId }, "Payment not found for callback");
      return;
    }

    if (payment.status === "PAID" || payment.status === "REFUNDED") {
      return;
    }

    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata as { Item: Array<{ Name: string; Value: unknown }> };
      const mpesaReceiptNumber = metadata?.Item?.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string;
      const amount = metadata?.Item?.find((i) => i.Name === "Amount")?.Value as number;
      const transactionDate = metadata?.Item?.find((i) => i.Name === "TransactionDate")?.Value as string;

      if (amount && amount !== payment.amountKes) {
        log.warn({ event: "payment.callback.amount_mismatch", expected: payment.amountKes, received: amount }, "Payment amount mismatch — DISPUTED");
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          mpesaReceiptNumber,
          completedAt: transactionDate ? new Date(transactionDate) : new Date(),
        },
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAID" },
      });

      const attemptCount = await prisma.paymentTransaction.count({
        where: { paymentId: payment.id },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: attemptCount + 1,
          checkoutRequestId,
          resultCode,
          resultDesc,
          mpesaReceiptNumber,
          rawCallback: JSON.parse(JSON.stringify(callbackBody)),
        },
      });
    } else {
      const failureReason = getFailureReason(resultCode);

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAYMENT_FAILED",
          failureReason,
        },
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAYMENT_FAILED" },
      });

      const attemptCount = await prisma.paymentTransaction.count({
        where: { paymentId: payment.id },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: attemptCount + 1,
          checkoutRequestId,
          resultCode,
          resultDesc,
          rawCallback: callbackBody as unknown as Prisma.InputJsonValue,
        },
      });
    }
  },

  async getAccessToken(): Promise<string> {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        auth: {
          username: config.DARAJA_CONSUMER_KEY,
          password: config.DARAJA_CONSUMER_SECRET,
        },
      }
    );
    return response.data.access_token;
  },
};

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(timestamp: string): string {
  const data = `${config.DARAJA_SHORTCODE}${config.DARAJA_PASSKEY}${timestamp}`;
  return Buffer.from(data).toString("base64");
}

function getFailureReason(code: number): string {
  const reasons: Record<number, string> = {
    1: "Insufficient funds",
    1032: "Request cancelled by user",
    1037: "DS timeout",
    2001: "Invalid credentials",
    2026: "Amount less than minimum",
    17: "Insufficient funds",
    26: "System busy",
  };
  return reasons[code] ?? `Daraja error code: ${code}`;
}