# RunnerBear v11.5 — Premium UX Lock

Status: LOCKED  
Release: 11.5.0

## Product outcome

v11.5 makes RunnerBear feel like one calm, premium coaching product. It improves hierarchy, interaction and accessibility without expanding coach authority or changing the canonical plan model.

## Locked experience

- Coach Live is a decision workspace, not a generic chat feed.
- Answers are visually structured around **Mitt råd**, **Hvorfor** and **Planen**.
- The current One Decision remains visible when it is relevant.
- Empty, loading, streaming, failed and retry states all have durable, understandable UI.
- Composer behavior is consistent: auto-growing input, Enter to send, Shift + Enter for a new line, and mobile safe-area support.
- Workout, plan proposal, health, goal, weekly review, sync and Coach Live dialogs share one surface, spacing, header, close target and focus treatment.
- Keyboard focus is trapped inside the active modal; Escape and backdrop dismissal remain available.
- Mobile uses a stable full-height Coach Live workspace and bottom sheets for other dialogs.

## Authority and safety boundaries

- Four navigation destinations remain: I dag, Plan, Mål and Mer.
- AI never writes the plan.
- A plan change still requires an explicit user choice and remains undoable.
- Automatic reduction remains capped at 20 percent.
- Plan revisions stay server-authoritative and are never mixed.
- Health language remains advice, not diagnosis.

## Release gates

- Canonical frontend assets identify build 11.5.0 and use cache key 11500.
- The stylesheet manifest contains one v11.5 premium UX source in place of the two superseded Coach Live patch layers.
- Production health reports `premium-ux-1`, structured Coach Live, unified dialogs, keyboard focus trapping, four navigation tabs, no AI plan writes and a 20 percent maximum reduction.
- Existing reliability, One Decision, continuity, history, sync and read-only health gates remain mandatory.
