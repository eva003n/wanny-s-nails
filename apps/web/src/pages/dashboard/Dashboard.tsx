import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Calendar, DollarSign, Users, Clock } from "lucide-react";

interface Booking {
  id: string;
  reference: string;
  customer: { name: string; phone: string };
  service: { name: string; priceKes: number };
  appointmentAt: string;
  status: string;
  paymentStatus: string;
}

export default function Dashboard() {
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const response = await api.get("/bookings/today");
        setTodayBookings(response.data);
      } catch (err) {
        console.error("Failed to fetch today's bookings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchToday();
  }, []);

  const totalRevenue = todayBookings
    .filter((b) => b.paymentStatus === "PAID")
    .reduce((sum, b) => sum + b.service.priceKes, 0);

  const stats = [
    { label: "Today's Appointments", value: todayBookings.length, icon: Calendar, color: "bg-blue-500" },
    { label: "Revenue Today", value: `KES ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "bg-green-500" },
    { label: "Pending Approvals", value: todayBookings.filter((b) => b.status === "PENDING").length, icon: Clock, color: "bg-yellow-500" },
    { label: "Customers", value: new Set(todayBookings.map((b) => b.customer.phone)).size, icon: Users, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className={`${stat.color} flex h-12 w-12 items-center justify-center rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
          ) : todayBookings.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No appointments today</div>
          ) : (
            todayBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{booking.customer.name}</p>
                  <p className="text-sm text-gray-500">{booking.service.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(booking.appointmentAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      booking.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : booking.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}