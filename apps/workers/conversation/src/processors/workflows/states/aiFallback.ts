// AI_FALLBACK is intentionally disabled — see .agents/whatsapp.md.
//
// Invalid input escalates directly to HUMAN_ESCALATION after 3 attempts;
// there is no AI-assisted intermediate state right now. This file is kept
// as the named extension point for re-introducing AI fallback behaviour
// (per .agents/workflow.md) without carrying a half-implemented handler.
