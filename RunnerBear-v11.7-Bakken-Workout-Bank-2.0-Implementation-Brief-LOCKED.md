# RunnerBear v11.7.0 – Bakken Workout Bank 2.0

Status: **LÅST · GODKJENT FOR PRODUKSJON**

## Produktmål

Workout Bank 2.0 erstatter den brede v11.0-banken med en gjenkjennelig, adaptiv Bakken-bank. Terskel er grunnstimuluset. X er et separat, kontrollert stimulus og er aldri obligatorisk som ukens andre kvalitetsøkt.

## Låste kontrakter

- Engine: `11.7.0`
- Workout bank: `2.0.0`
- Policy: `avoidHillWorkouts: true`
- Historiske økter før dagens dato er immutable.
- Fremtidige planlagte økter fra gammel bank repareres idempotent uten å endre dato, workout-ID, eksplisitte flyttinger eller planlagt ukesmengde.
- Endrede fremtidige økter projiseres gjennom eksisterende Tredict-outbox.
- Browser- og serverbank skal ha identisk struktur.

## Aktiv kjerne

| Gruppe | Økt | Pause | Arbeid | Kostnad |
|---|---|---:|---:|---:|
| Hovedterskel | 6 × 6 min | 90 sek | 36 min | 2 |
| Hovedterskel | 4 × 8 min | 180 sek | 32 min | 2 |
| Hovedterskel | 3 × 10 min | 120 sek | 30 min | 2 |
| Hovedterskel | 4 × 10 min | 90 sek | 40 min | 3 |
| Støtteterskel | 6 × 5 min | 45 sek | 30 min | 2 |
| Støtteterskel | 10 × 3 min | 60 sek | 30 min | 2 |
| Støtteterskel | 15 × 1 min | 30 sek | 15 min | 1 |
| X | 20 × 45/15 | 15 sek | 15 min | 2 |
| X | 30 × 45/15 | 15 sek | 22:30 | 3 |
| X | 6 × 3 min | 90 sek | 18 min | 3 |

`4 × 2000 m`, `8 × 2 min`, `5 × 1000 m` og løpsspesifikke økter er tilgjengelige som spesialistøkter. `5 × 1000 m` krever 5/10 km-mål, SPECIFIC-fase og positivt responsbilde. Taperfamilien beholdes utenfor normal CORE-rotasjon.

## Fjernet fra aktiv bank

`threshold-5x8`, `threshold-3x12`, `threshold-24x45-15`, `threshold-12x400` og `x-10x60-hills` er ikke aktive kandidater. Historiske referanser beholdes urørt.

## Produksjonsporter

Release krever grønn full testpakke, grønn `npm run check`, strukturverifisering mot Tredict og grønn `/health` med:

- `bakkenEngineVersion: "11.7.0"`
- `bakkenWorkoutBankVersion: "2.0.0"`
- `hillWorkoutsEnabled: false`
- `bakkenPlanAudit.ok: true`
- ingen fremtidige bakkeøkter, ukjente bank-ID-er eller ordinære toukers-kvalitetsuker uten terskelanker
- bevart historikkintegritet og frisk Tredict-outbox
