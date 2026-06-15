import { useEffect, useState } from "react";
import api from "../../lib/api";

interface Booking {
  id: string;
  reference: string;
  customer: { name: string; phone: string };
  service: { name: string; priceKes: number };
  payment: { status: string; mpesaReceiptNumber: string | null; amountKes: number } | null;
}

export default function Payments() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await api.get("/bookings");
        setBookings(response.data.filter((b: Booking) => b.payment));
      } catch (err) {
        console.error("Failed to fetch payments", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payments</h1>

      <div className="rounded-lg bg-white shadow">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">No payment records found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Booking Ref</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">M-Pesa Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{booking.reference}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{booking.customer.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">KES {booking.payment?.amountKes.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      booking.payment?.status === "PAID" ? "bg-green-100 text-green-700" :
                      booking.payment?.status === "PAYMENT_PENDING" ? "bg-yellow-100 text-yellow-700" :
                      booking.payment?.status === "PAYMENT_FAILED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{booking.payment?.status ?? "N/A"}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{booking.payment?.mpesaReceiptNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}