import { prisma } from "../../../shared/lib/index.js";
import { logger } from "../../../shared/lib/index.js";


const log = logger.child({ module: "dashboard" });

export interface DashboardStats {
  todayBookingsCount: number;
  pendingCount: number;
  todayRevenueKes: number;
  unpaidKes: number;
  weekRevenueKes: number;
  monthRevenueKes: number;
  reconciliation: {
    stuckPaymentsCount: number;
    oldestStuckPaymentAt: string | null;
  };
}

// A payment stuck PENDING longer than this is a callback-delivery problem, not
// a customer still typing their M-Pesa PIN — matches PAYMENT_WORKFLOW.md's
// reconciliation sweep threshold.
const RECONCILIATION_STALE_THRESHOLD_MINUTES = 10;

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

    // 3. Today's revenue (SUCCESS payments for today's bookings)
    const todayRevenue = await prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
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

    // 4. Unpaid amount (all PENDING payments)
    const unpaidPayments = await prisma.payment.aggregate({
      where: {
        status: "PENDING",
      },
      _sum: {
        amountKes: true,
      },
    });
    const unpaidKes = unpaidPayments._sum.amountKes ?? 0;

    // 5. Week revenue (SUCCESS payments since week start)
    const weekRevenue = await prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
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

    // 6. Month revenue (SUCCESS payments since month start)
    const monthRevenue = await prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
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

    // 7. Reconciliation snapshot (stuck-payments queue)
    const staleThreshold = new Date(
      now.getTime() - RECONCILIATION_STALE_THRESHOLD_MINUTES * 60 * 1000,
    );
    const [stuckPaymentsCount, oldestStuckPayment] = await Promise.all([
      prisma.payment.count({
        where: { status: "PENDING", createdAt: { lt: staleThreshold } },
      }),
      prisma.payment.findFirst({
        where: { status: "PENDING", createdAt: { lt: staleThreshold } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

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
      reconciliation: {
        stuckPaymentsCount,
        oldestStuckPaymentAt: oldestStuckPayment?.createdAt.toISOString() ?? null,
      },
    };
  },
};
