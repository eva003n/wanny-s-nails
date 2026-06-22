export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}

export function formatDayHeader(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
}

export function isSameDay(isoA: string, isoB: string): boolean {
  return new Date(isoA).toDateString() === new Date(isoB).toDateString();
}

export function isToday(iso: string): boolean {
  return isSameDay(iso, new Date().toISOString());
}

export function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
