export { NotificationService } from "./NotificationService.js";
export type { NotificationJobPayload, ScheduleParams } from "./NotificationService.js";
export {
  NOTIFICATION_TRIGGERS,
  evaluateCondition,
} from "./triggers.js";
export type {
  NotificationContext,
  NotificationEventType,
  RecipientConfig,
} from "./triggers.js";
export {
  TEMPLATES,
  renderTemplate,
  renderTemplateForChannel,
} from "./templates/registry.js";
export type { TemplateConfig, TemplateName } from "./templates/registry.js";