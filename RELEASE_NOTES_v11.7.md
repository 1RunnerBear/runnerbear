# RunnerBear v11.7.0

## Bakken Workout Bank 2.0

- Ny stram kjerne med 4 × 8, 3 × 10, 6 × 5, 10 × 3, 20 × 45/15, 30 × 45/15 og 6 × 3.
- 6 × 6 bruker nå 90 sek rolig jogg.
- 20 × 45/15 er normal/moderat X-dose; 30 × 45/15 er full dose ved riktig respons og fase.
- 3 × 10 er normal dose i 10-minuttersfamilien; 4 × 10 krever positiv BUILD-respons.
- HOLD, REDUCE og RECOVERY kan ikke eskalere til X.
- Eksplisitte bakkeøkter er fjernet fra den aktive banken og blokkert i automatisk planlegging.
- Fremtidige gamle resepter repareres idempotent. Datoer, workout-ID-er, manuelle flyttinger, planlagt volum og historikk bevares.
- Workout Bank-visningen er gruppert i Hovedterskel, Støtteterskel, X-økter, Løpsspesifikt og Redusert dose.
- Nye resepter serialiseres som strukturerte Tredict-intervaller via eksisterende automatiske synk.
- Produksjons-health rapporterer engine/bank-versjon, no-hill-status og utvidet Bakken-plan-audit.
