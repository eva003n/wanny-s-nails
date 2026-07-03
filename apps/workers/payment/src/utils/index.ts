export function getFailureReason(code: number): string {
  const reasons: Record<number, string> = {
    0: "Payment successful", 
    1: "Insufficient M-Pesa balance (including Fuliza unavailable", // failed
    17: "Internal Safaricom/Party B processing error", // failed
    26: "System busy", //failed
    1001: "Customer has another M-Pesa/USSD transaction in progress.", // pending
    1032: "Customer cancelled the STK prompt", // cancelled
    1019: "Transaction expired before completion", // expired
    1037: "DS timeout/customer unreachable/no response", // expired
    2001: "Wrong M-Pesa PIN entered", // failed
    2026: "Amount less than minimum", // failed
    4999: "Still processing transaction", // pending
  };
  return reasons[code] ?? `Daraja error code: ${code}`;
}

export function getTerminalStatus(code: string | number) {
  const resultCode = Number(code)
  return resultCode === 1032
    ? "CANCELLED"
    : resultCode === 1037 || resultCode === 1019
      ? "EXPIRED"
      : resultCode === 1001 || resultCode === 4999
        ? "PENDING"
        : "FAILED";

}
