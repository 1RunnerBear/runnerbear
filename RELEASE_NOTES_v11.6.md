# RunnerBear v11.6 — Contextual Coach

RunnerBear now behaves like a coach that follows the athlete in the background instead of a chatbot waiting for questions.

## Changed

- Removed Coach Live chat, composer, prompts and launch points.
- Made the existing server-authoritative One Decision the single “Coachens råd” experience.
- Added a compact health trend on Today with the detailed Body Response view one tap away.
- Kept coach feedback next to the workout, plan change, weekly review and goal evidence it explains.
- Clarified pre-workout advice versus post-workout verdict and consequence.
- Replaced the chat-heavy v11.5 style layer with a smaller contextual-coach layer.
- Former Coach Live endpoints now return `410 Gone` behind the existing private Access layer; no AI inference binding is used.

## Preserved

- Design Direction 1.0 / Concept 1 / Premium rolig.
- Bakken Adaptive Coach and Body Response authority.
- Four navigation tabs.
- Server-authoritative plan revisions, explicit confirmation, undo and durable Tredict sync.
- Maximum automatic dose reduction of 20 percent.
- Non-destructive history and rollback path.
