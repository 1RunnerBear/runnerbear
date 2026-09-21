# RunnerBear 12.6.0 — Concept 1 A

The approved Concept 1 A evolves the existing four-tab app with warm ivory, forest green, serif headings, restrained photography and a clearer daily action.

- Today leads with the actual workout or required health clarification, then coaching context and the next planned step. Completion and rest retain their own presentation.
- Adaptation separates the need, proposed workout, weekly impact and explicit save. Less time reduces supported threshold repetitions with fixed warm-up/cool-down, matching recovery, duration and export structure. Unsupported structures do not receive a misleading kilometre-only reduction. Alternative activity remains an explicit athlete choice.
- Canonical preview/commit uses revision checks and stable idempotency keys. The current compatibility path previews one-day changes, verifies saving and restores state on failure. No new rollout flags are enabled.
- Health details show current values, personal references and available 7/28-day summaries. Missing metrics are explicit and cannot claim normal health. Plan, goals and More use consistent headings, quieter lists and contextual controls.

## Verification

438 functional tests pass locally, including exact interval duration, stale previews, failed writes and confirmed commit with failed refresh. 24 Chromium checks cover 200% text resizing, symptom capture, failed health-check saving, 320–430 px, existing desktop widths, all four tabs, dialogs, images, cancel/retry/save and revision changes. GitHub CI also runs WebKit before merge. Public push and production deployment were explicitly authorized in the active conversation. GitHub PR validation passed all 48 Chromium/WebKit cases; startup geometry now waits for the render-blocking stylesheet before measurement. Browser emulation does not replace a physical iPhone check.

The canonical client remains three JS requests and one CSS request. New preview and health interfaces increase compressed JavaScript by about 5 KB; the per-release ceilings are 490 KB raw / 140 KB gzip. The existing total compressed-asset growth gate remains unchanged. No runtime dependencies or new photos were added.

Production goes through the existing backup, history-preservation, private-access and health/data-trust verification workflow. The separate Coach Loop transport rollout remains gated; this UI release does not resolve or bypass its existing provider capability limitation.
