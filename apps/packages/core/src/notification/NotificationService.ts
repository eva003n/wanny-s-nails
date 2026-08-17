/**
 * Shared Notification Service
 *
 * Orchestrates notification dispatching and scheduling.
 * Designed to be used by both the API process and worker processes.
 */
import type { Queue } from "bullmq";
import { normalizeKenyanPhone } from "../utils/phone.js";
import {
  NOTIFICATION_TRIGGERS,
  evaluateCondition,
  type NotificationContext,
  type NotificationEventType,
  type RecipientConfig,
} from "./triggers.js";
import { renderTemplateForChannel } from "./templates/registry.js";
import type { Logger } from "pino";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;



export interface NotificationJobPayload {
  notificationId: string;
  recipientId: string;
  recipientType: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  endpoint: {
    address: string;
    type: "phone" | "email" | "push_subscription";
  };
  eventType: string;
  bookingId: string;
}

export interface ScheduleParams {
  bookingId: string;
  eventType: NotificationEventType;
  recipientType: string;
  channel: string;
  scheduledAt: Date;
  template: string;
  context: NotificationContext;
}

export class NotificationService {
  constructor(
    private readonly deps: {
      prisma: PrismaClientLike;
      notificationQueue: Queue;
      log: Logger
    },
  ) {}

  /**
   * Dispatch a notification event to all configured recipients.
   */
  async dispatch(
    eventType: NotificationEventType,
    context: NotificationContext,
  ): Promise<void> {
    const trigger = NOTIFICATION_TRIGGERS[eventType];
    if (!trigger) {
      this.deps.log.warn(
        { event: "dispatch.unknown_type", eventType },
        "No trigger registered for event type",
      );
      return;
    }

    this.deps.log.info(
      { event: "dispatch.start", eventType, bookingId: context.bookingId },
      "Dispatching notifications",
    );

    for (const recipientConfig of trigger.recipients) {
      try {
        const rc = recipientConfig as RecipientConfig;
        if (rc.condition && !evaluateCondition(rc.condition, context)) {
          this.deps.log.debug(
            { event: "dispatch.condition_skipped", condition: rc.condition, recipientType: rc.type },
            "Condition not met — skipping recipient",
          );
          continue;
        }

        const endpoint = await this.resolveEndpoint(recipientConfig.type, recipientConfig.channel, context);
        if (!endpoint) {
          this.deps.log.warn(
            { event: "dispatch.no_endpoint", recipientType: recipientConfig.type, channel: recipientConfig.channel, bookingId: context.bookingId },
            "No active endpoint for recipient — skipping",
          );
          continue;
        }

        const idempotencyKey = `${context.bookingId}.${eventType}.${recipientConfig.channel}.${recipientConfig.type}`;

        const existing = await this.deps.prisma.notification.findUnique({
          where: { idempotencyKey },
        });

        if (
          existing &&
          ["QUEUED", "SENT", "PROCESSING", "DELIVERED", "READ", "DEAD_LETTER"].includes(existing.status)
        ) {
          this.deps.log.info(
            { event: "schedule.already_processed", notificationId: existing.id, status: existing.status },
            "Notification already sent or in-flight — skipping",
          );
          continue;
        }

        const payload = renderTemplateForChannel(
          recipientConfig.template,
          context as unknown as Record<string, unknown>,
        );

        const recipientId =
          endpoint.type === "push_subscription"
            ? endpoint.address
            : context.customerId;

        const notification = await this.deps.prisma.notification.upsert({
          where: { idempotencyKey },
          create: {
            bookingId: context.bookingId,
            recipientId,
            recipientType: recipientConfig.type,
            type: eventType,
            channel: recipientConfig.channel,
            payload,
            idempotencyKey,
            status: "PENDING",
            correlationId: context.bookingId,
          },
          update: {
            payload,
            status: "PENDING",
          },
        });

        const jobId = `${recipientConfig.channel.toLowerCase()}.${notification.id}`;

        try {
          await this.deps.notificationQueue.add(
            `send-${recipientConfig.channel.toLowerCase()}`,
            {
              notificationId: notification.id,
              recipientId,
              recipientType: recipientConfig.type,
              channel: recipientConfig.channel,
              template: recipientConfig.template,
              payload,
              endpoint,
              eventType,
              bookingId: context.bookingId,
            } satisfies NotificationJobPayload,
            { jobId },
          );
        } catch (enqueueError: unknown) {
          const err = enqueueError as { message?: string };
          this.deps.log.error(
            { event: "dispatch.enqueue_failed", notificationId: notification.id, bookingId: context.bookingId, error: err.message },
            "Failed to enqueue notification job after DB write — marking as FAILED",
          );
          await this.deps.prisma.notification.update({
            where: { id: notification.id },
            data: { status: "FAILED" },
          });
          throw enqueueError;
        }

        await this.deps.prisma.notification.update({
          where: { id: notification.id },
          data: { status: "QUEUED" },
        });

           this.deps.log.info(
             {
               event: "dispatch.enqueued",
               notificationId: notification.id,
               channel: recipientConfig.channel,
               recipientType: recipientConfig.type,
               bookingId: context.bookingId,
             },
             "Notification enqueued",
           );
      } catch (error) {
        
           this.deps.log.error(
             {
               event: "dispatch.recipient_failed",
               recipientType: recipientConfig.type,
               channel: recipientConfig.channel,
               error: error instanceof Error ? error.message : String(error),
               bookingId: context.bookingId,
             },
             "Failed to dispatch for recipient",
           );
      }
    }
  }

  /**
   * Schedule a notification for a future time (e.g., reminder).
   */
  async schedule(params: ScheduleParams): Promise<void> {
    const idempotencyKey = `${params.bookingId}.${params.eventType}.${params.channel}.${params.recipientType}`;
    const delayMs = params.scheduledAt.getTime() - Date.now();

    this.deps.log.info({
      event: "schedule.requested",
      bookingId: params.bookingId,
      delayMs,
      scheduledAt: params.scheduledAt,
    });

    if (delayMs <= 0) {
      
           this.deps.log.info(
             {
               event: "schedule.past_time",
               bookingId: params.bookingId,
               eventType: params.eventType,
             },
             "Schedule time already passed — dispatching immediately",
           );
      await this.dispatch(params.eventType, params.context);
      return;
    }

    const renderedPayload = renderTemplateForChannel(
      params.template,
      params.context as unknown as Record<string, unknown>,
    );

    const existing = await this.deps.prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (
      existing &&
      ["QUEUED", "SENT", "PROCESSING", "FAILED", "DELIVERED", "READ", "DEAD_LETTER"].includes(existing.status)
    ) {
      
           this.deps.log.info(
             {
               event: "schedule.already_processed",
               notificationId: existing.id,
               status: existing.status,
             },
             "Notification already sent or in-flight — skipping",
           );
      return;
    }

    const notification = await this.deps.prisma.notification.upsert({
      where: { idempotencyKey },
      create: {
        bookingId: params.bookingId,
        recipientId: params.context.customerId,
        recipientType: params.recipientType,
        type: params.eventType,
        channel: params.channel,
        payload: renderedPayload,
        idempotencyKey,
        status: "SCHEDULED",
        scheduledAt: params.scheduledAt,
        correlationId: params.bookingId,
      },
      update: {
        scheduledAt: params.scheduledAt,
        payload: renderedPayload,
        status: "SCHEDULED",
      },
    });

    const jobId = `scheduled.${notification.id}`;

    try {
      await this.deps.notificationQueue.add(
        `send-${params.channel.toLowerCase()}`,
        {
          notificationId: notification.id,
          recipientId: params.context.customerId,
          recipientType: params.recipientType,
          channel: params.channel,
          template: params.template,
          payload: renderedPayload,
          endpoint: {
            address: params.context.customerPhone,
            type: "phone",
          },
          eventType: params.eventType,
          bookingId: params.bookingId,
        } satisfies NotificationJobPayload,
        { delay: Math.max(delayMs, 1000), jobId },
      );
    } catch (error: unknown) {
      const err = error as { message?: string };
      
           this.deps.log.error(
             {
               event: "schedule.enqueue_failed",
               notificationId: notification.id,
               bookingId: params.bookingId,
               error: err.message,
             },
             "Failed to enqueue notification job after DB write — marking as FAILED",
           );
      await this.deps.prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      throw error;
    }

    
           this.deps.log.info(
             {
               event: "schedule.enqueued",
               notificationId: notification.id,
               bookingId: params.bookingId,
               scheduledAt: params.scheduledAt,
             },
             "Scheduled notification enqueued",
           );
  }

  /**
   * Handle booking rescheduled — cancel old reminders and schedule new ones.
   */
  async onBookingRescheduled(
    bookingId: string,
    newAppointmentAt: Date,
  ): Promise<void> {
    const existingReminders = await this.deps.prisma.notification.findMany({
      where: {
        bookingId,
        type: "APPOINTMENT_REMINDER",
        status: "SCHEDULED",
      },
    });

    for (const reminder of existingReminders) {
      try {
        await this.deps.notificationQueue.remove(`scheduled.${reminder.id}`);
      } catch (error: unknown) {
        const err = error as { message?: string };
        
           this.deps.log.warn(
             {
               event: "reschedule.queue_remove_failed",
               notificationId: reminder.id,
               bookingId,
               error: err.message,
             },
             "Failed to remove old reminder job from queue",
           );
      }
    }

    if (existingReminders.length > 0) {
      await this.deps.prisma.notification.updateMany({
        where: { id: { in: existingReminders.map((r: any) => r.id) } },
        data: { status: "CANCELLED" },
      });
    }

    await this.scheduleAppointmentReminders(bookingId, newAppointmentAt);
  }

  /**
   * Handle booking cancelled — cancel all scheduled reminders.
   */
  async onBookingCancelled(bookingId: string): Promise<void> {
    const scheduledReminders = await this.deps.prisma.notification.findMany({
      where: {
        bookingId,
        type: "APPOINTMENT_REMINDER",
        status: "SCHEDULED",
      },
    });

    for (const reminder of scheduledReminders) {
      try {
        await this.deps.notificationQueue.remove(`scheduled.${reminder.id}`);
        await this.deps.notificationQueue.remove(`whatsapp.${reminder.id}`);
      } catch (error: unknown) {
        const err = error as { message?: string };
        
           this.deps.log.warn(
             {
               event: "cancel.queue_remove_failed",
               notificationId: reminder.id,
               bookingId,
               error: err.message,
             },
             "Failed to remove reminder job from queue",
           );
      }
    }

    if (scheduledReminders.length > 0) {
      await this.deps.prisma.notification.updateMany({
        where: { id: { in: scheduledReminders.map((r: any) => r.id) } },
        data: { status: "CANCELLED" },
      });
    }
  }

  /**
   * Schedule 24h appointment reminders.
   */
  async scheduleAppointmentReminders(
    bookingId: string,
    appointmentAt: Date,
  ): Promise<void> {
    const now = new Date();
    const twentyFourHoursBefore = new Date(appointmentAt.getTime() - 24 * 60 * 60 * 1000);

    const booking = await this.deps.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true },
    });

    if (!booking) {
      
           this.deps.log.warn(
        { event: "schedule.reminders.booking_not_found", bookingId },
        "Cannot schedule reminders — booking not found",
      );
      return;
    }

    const context: NotificationContext = {
      bookingId: booking.id,
      customerId: booking.customerId,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      customerEmail: booking.customer.email ?? undefined,
      serviceName: booking.service.name,
      appointmentAt: booking.appointmentAt.toISOString(),
      amountKes: booking.priceKes,
    };

    if (twentyFourHoursBefore > now) {
      await this.schedule({
        bookingId,
        eventType: "APPOINTMENT_REMINDER",
        recipientType: "CLIENT",
        channel: "WHATSAPP",
        scheduledAt: twentyFourHoursBefore,
        template: "reminder_24h",
        context,
      });
    }
  }

  // ─── Private ──────────────────────────────────────────────────

  private async resolveEndpoint(
    recipientType: string,
    channel: string,
    context: NotificationContext,
  ): Promise<{ address: string; type: "phone" | "email" | "push_subscription" } | null> {
    if (channel === "WHATSAPP") {
      const raw = context.customerPhone;
      if (!raw) throw new Error("Missing customer phone");
      return { address: normalizeKenyanPhone(raw), type: "phone" };
    }

    if (channel === "EMAIL") {
      return context.customerEmail
        ? { address: context.customerEmail, type: "email" }
        : null;
    }

    if (channel === "PUSH") {
      const userIds = context.adminUserIds;
      if (!userIds || userIds.length === 0) {
        
           this.deps.log.debug(
             { event: "resolve_endpoint.no_admin_users" },
             "No admin user IDs for push notification",
           );
        return null;
      }
      return { address: userIds[0] as string, type: "push_subscription" };
    }

    return null;
  }
}