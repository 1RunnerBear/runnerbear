# RunnerBear v12.5 · Premium Mobile & Visual Lock

Approved scope: attached locked brief, 15 September 2026. UX and visual foundation only.

The root cause was a dark foundation, geometry gated on `rb107-ready`, and conflicting boot navigation rules (including a 720px startup breakpoint versus the 820px finished shell). The canonical foundation now owns colors, page gutters, navigation, safe areas and startup geometry. Desktop navigation only activates from 821px. Runtime-ready state only controls data visibility.

Workout media uses 16:10 and goal media 16:9. Absolutely positioned images reserve geometry before loading; text cannot grow the image. Prescription, recovery, duration, distance and focus are below the workout image. Primary workout images load eagerly with high priority; secondary images load lazily. All six existing photographs were visually reviewed and retained with individual focal positions. Their muted green/warm palette and subject placement support Concept 1.

The five existing CSS source layers are retained. Superseded shell and media rules and exact shadowed declarations were removed. Metadata has an 11px minimum, shared dialog geometry is mobile bottom sheet / desktop centered modal, navigation remains 72px plus the safe area, and keyboard focus/reduced motion remain supported.

Validation before release: 431 existing functional tests passed. New foundation contracts and a Chromium/WebKit visual matrix cover 360, 375, 390, 393, 430, landscape 844, and desktop 1024/1280/1440; startup/ready/warm geometry, four main views, workout detail, error, slow bootstrap, focal cropping, long hero copy, keyboard containment and touch targets. CI screenshots and reports are retained for review. Physical iPhone Safari and installed standalone PWA require device testing; WebKit is engine-level coverage.

No changes to coach rules, workout bank, HRV, plan generation, provider logic, data model or One Decision authority. Server edits only advance the build identifier. Production deploy uses the existing workflow with history backup, integrity checks and private access verification.

Release status: pending visual CI and production verification.
