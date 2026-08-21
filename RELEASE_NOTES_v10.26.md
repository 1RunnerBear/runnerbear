# RunnerBear v10.26 — Coach Loop

RunnerBear now has one versioned plan, one plan-bound coach decision and one canonical 10-day sync projection. Completed load, decision-relevant feedback and the next health response can change the next recommendation, while every plan mutation is revision-checked, explained and reversible.

The release keeps Design Direction 1.0 / Concept 1 / Premium rolig. Today still leads with the workout hero, visible health basis and coach feedback. Technical workout diagnostics are hidden from the active Coach Loop surface, and post-workout questions appear only when the answer can affect the plan.

The coach still does not diagnose injury, add intensity or volume automatically, create multi-goal seasons, provide chat, send push notifications or integrate directly with Garmin Training API. Tredict remains the plan transport to Garmin.

Safe autopilot is implemented behind `coach_loop_safe_auto`, remains off at release, and requires both the full staged rollout and explicit athlete opt-in. Automatic changes are capped, plan-bound and undoable. Rollback is flag-driven; schema v2 and history are retained.
