import { prisma } from "@wannys-nails/packages";
import { logger } from "@wannys-nails/packages";

const log = logger.child({ module: "dashboard" });

export interface DashboardStats {
  todayBookingsCount: number;
  pendingCount: number;
  todayRevenueKes: number;
  unpaidKes: number;
  weekRevenueKes: number;
  monthRevenueKes: number;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const now = new Date();

    // Today's date range (EAT/UTC+3)
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Week start (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(
      now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1),
    );
    weekStart.setHours(0, 0, 0, 0);

    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Today's bookings count
    const todayBookingsCount = await prisma.booking.count({
      where: {
        appointmentAt: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: { not: "CANCELLED" },
      },
    });

    // 2. Pending count (all pending bookings, not just today)
    const pendingCount = await prisma.booking.count({
      where: {
        status: "PENDING",
      },
    });

    // 3. Today's revenue (PAID payments for today's bookings)
    const todayRevenue = await prisma.payment.aggregate({
      where: {
        status: "PAID",
        booking: {
          appointmentAt: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
      },
      _sum: {
        amountKes: true,
      },
    });
    const todayRevenueKes = todayRevenue._sum.amountKes ?? 0;

    // 4. Unpaid amount (all UNPAID or PAYMENT_PENDING payments)
    const unpaidPayments = await prisma.payment.aggregate({
      where: {
        status: { in: ["UNPAID", "PAYMENT_PENDING"] },
      },
      _sum: {
        amountKes: true,
      },
    });
    const unpaidKes = unpaidPayments._sum.amountKes ?? 0;

    // 5. Week revenue (PAID payments since week start)
    const weekRevenue = await prisma.payment.aggregate({
      where: {
        status: "PAID",
        booking: {
          appointmentAt: {
            gte: weekStart,
            lt: now,
          },
        },
      },
      _sum: {
        amountKes: true,
      },
    });
    const weekRevenueKes = weekRevenue._sum.amountKes ?? 0;

    // 6. Month revenue (PAID payments since month start)
    const monthRevenue = await prisma.payment.aggregate({
      where: {
        status: "PAID",
        booking: {
          appointmentAt: {
            gte: monthStart,
            lt: now,
          },
        },
      },
      _sum: {
        amountKes: true,
      },
    });
    const monthRevenueKes = monthRevenue._sum.amountKes ?? 0;

    log.debug(
      {
        event: "dashboard.stats.calculated",
        todayBookingsCount,
        pendingCount,
        todayRevenueKes,
        unpaidKes,
        weekRevenueKes,
        monthRevenueKes,
      },
      "Dashboard stats calculated",
    );

    return {
      todayBookingsCount,
      pendingCount,
      todayRevenueKes,
      unpaidKes,
      weekRevenueKes,
      monthRevenueKes,
    };
  },
};
