# WhatsApp FSM + AI Rules

## Session
- Key: `session:+254XXXXXXXXX` (E.164 format)
- TTL: 1800s — reset on every message
- Every handler: load session → validate input → transition → save session → send messages
- Dedup: store `wamid` in Redis with 5-min TTL before processing. Discard if key exists.
- Always return HTTP 200 to WhatsApp immediately. Process async via queue.

## Invalid input escalation ladder
```
Invalid input ×1–2  →  resend menu with hint
Invalid input ×3    →  AI_FALLBACK
AI cannot resolve   →  HUMAN_ESCALATION
```
Never jump from `invalidInputCount >= 3` straight to `HUMAN_ESCALATION`.

## AI_FALLBACK (Gemini 2.0 Flash)
- Use last 6 messages as context (`session.aiContext`), sliced to keep tokens low.
- Hard cap: `maxOutputTokens: 150`.
- Transition rules from AI reply:
  - Contains `"MENU"` → `GREETING`
  - Contains `"HUMAN"` → `HUMAN_ESCALATION`
  - Anything else → stay in `AI_FALLBACK`
- Gemini API error or timeout → fail safe to `HUMAN_ESCALATION` immediately.
- `GEMINI_API_KEY` not set → skip AI, go straight to `HUMAN_ESCALATION`.

## HUMAN_ESCALATION
Triggered only by:
1. Customer sends "human" / "agent" / "help me" / "talk to someone" (any state)
2. `AI_FALLBACK` cannot resolve

Action: enqueue Web Push notification to owner's PWA. Fallback to WhatsApp message to owner's personal number if push permission not granted.

## Global intents (checked before state handler)
| Keyword | Action |
|---|---|
| "stop" / "STOP" / "unsubscribe" | Opt out, log consent withdrawal |
| "human" / "agent" / "help me" | → `HUMAN_ESCALATION` directly |
| "menu" / "start" (non-IDLE) | → `GREETING` |

## Adding a new FSM state
1. Add state to `ConversationState` type.
2. Create handler in `workflows/states/`.
3. Add transitions to the diagram in `WHATSAPP_AUTOMATION.md`.
4. Add unit test for all valid + invalid inputs.

## Adding a new WhatsApp template
1. Add spec to `WHATSAPP_AUTOMATION.md`.
2. Submit for Meta approval — allow 1–3 business days.
3. Do not deploy code that uses the template until approval is confirmed.
