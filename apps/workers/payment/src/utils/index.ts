export function getFailureReason(code: number): string {
  const reasons: Record<number, string> = {
    1: "Insufficient funds",
    1032: "Request cancelled by user",
    1037: "Payment request timeout",
    2001: "Invalid credentials",
    2026: "Amount less than minimum",
    17: "Insufficient funds",
    26: "System busy",
    4999: "Still processing transaction"
  };
  return reasons[code] ?? `Daraja error code: ${code}`;
}
