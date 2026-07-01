import { log, prisma } from "../lib/index.js";


async function processMpesaCallback(body: DarajaCallbackBody) {
  const { stkCallback } = body.Body;
  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
    stkCallback;

  // 1. Find the pending payment
  const payment = await prisma.payment.findUnique({
    where: { checkoutRequestId: CheckoutRequestID },
    include: { booking: { include: { customer: true, service: true } } },
  });

  if (!payment) {
    log.warn(
      { CheckoutRequestID },
      "Callback for unknown CheckoutRequestID",
    );
    return; // Not our transaction
  }

  // 2. Idempotency check
  if (ResultCode === 0) {
    const receiptNumber = extractMetadata(
      CallbackMetadata,
      "MpesaReceiptNumber",
    );
    const existing = await prisma.paymentTransaction.findUnique({
      where: { mpesaReceiptNumber: receiptNumber },
    });
    if (existing) {
      logger.info({ receiptNumber }, "Duplicate callback — already processed");
      return;
    }
  }

  // 3. Begin transaction
  await prisma.$transaction(async (tx) => {
    if (ResultCode === 0) {
      const amount = extractMetadata(CallbackMetadata, "Amount");
      const receiptNumber = extractMetadata(
        CallbackMetadata,
        "MpesaReceiptNumber",
      );
      const transactionDate = extractMetadata(
        CallbackMetadata,
        "TransactionDate",
      );

      // Amount verification
      if (amount !== payment.amountKes) {
        // Flag as disputed, alert owner
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "PAYMENT_FAILED",
            failureReason: `Amount mismatch: expected ${payment.amountKes}, received ${amount}`,
          },
        });
        //await alertOwner("PAYMENT_AMOUNT_MISMATCH", payment);
        return;
      }

      // Successful payment
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: await getAttemptNumber(payment.id),
          checkoutRequestId: CheckoutRequestID,
          resultCode: 0,
          resultDesc: ResultDesc,
          mpesaReceiptNumber: receiptNumber,
          rawCallback: body as any,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          mpesaReceiptNumber: receiptNumber,
          completedAt: parseDarajaDate(transactionDate),
        },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAID" },
      });
    } else {
      // Failed payment
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: await getAttemptNumber(payment.id),
          resultCode: ResultCode,
          resultDesc: ResultDesc,
          rawCallback: body as any,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: `ResultCode ${ResultCode}: ${ResultDesc}`,
        },
      });
    }
  });

  // 4. Notify customer (outside transaction — non-critical)
  if (ResultCode === 0) {
    await notificationQueue.add("whatsapp-payment-confirmed", {
      phone: payment.booking.customer.phone,
      bookingRef: payment.booking.reference,
      amountKes: payment.amountKes,
    });
  } else {
    await notificationQueue.add("whatsapp-payment-failed", {
      phone: payment.booking.customer.phone,
      resultCode: ResultCode,
      bookingRef: payment.booking.reference,
    });
  }
}
