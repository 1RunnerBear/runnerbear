# RunnerBear 10.31.1

## Automatisk kalender og rask oppstart

- Canonical Coach Loop er eneste eier av planendringer mot Tredict; det eldre helplanslaget kan ikke publisere parallelt.
- Stabile provider-bindinger bevarer samme Tredict-økt når datoen endres, mens rullerende ti-dagerssynk fylles automatisk av cron.
- Duplikate RunnerBear-markører oppdages uten å opprette enda en plan, og manuell Tredict-synk er fjernet fra Plan.
- Sist verifiserte canonical snapshot vises umiddelbart og revalideres i bakgrunnen uten den blokkerende oppstartsskjermen.
- Forrige uke viser kvalitetsøkter, langtur, totale løpskilometer, løpstid og en datadrevet coachvurdering.

## Coachens ukereview

- Ny kanonisk `weeklyReview` oppsummerer forrige uke mot faktisk Garmin/Concept2-grunnlag.
- Reviewen skiller løping, nøkkeløkter, alternativ trening og tapte økter uten falske løpskilometer.
- «I dag» viser en kompakt konklusjon og en tilgjengelig full ukereview.

## Automatisk fremoverrettet realignment

- Ny revisjonsbundet `realignmentProposal` vurderer tapte økter, eksplisitt meldt sykdom og alternativ trening.
- Tapte økter skaper ikke treningsgjeld, og tapt kvalitet flyttes aldri blindt.
- Eksplisitt sykdom kan ta ut opptil 72 timer fremtidig løpsbelastning; løp og låste økter krever fortsatt valg.
- Concept2/sykkel kan erstatte aerob støtte uten mekaniske løpskilometer eller falsk kvalitetskreditt.
- Safe-auto-realighting er CAS-beskyttet, atomisk og bruker eksisterende Angre- og synk-outbox.

## Tredict/Garmin-reparasjon

- Ny `syncRepair` skiller automatisk retry, manglende Tredict-aktivering, kilde som ikke finnes og strukturell kontroll.
- Plan og Mer viser én rolig reparasjonsflyt med konkrete steg.
- Eksplisitt «Kontroller på nytt» kan verifisere manuelt rettede cancel/replace-operasjoner; cron gjentar dem ikke destruktivt.

## Integritet

- RunnerBear er fortsatt eneste sannhetskilde, historikk er uforanderlig og synkhorisonten er ti dager.
- Ingen volumgjeld, doseøkning, terskel→VO₂-glidning eller gammel revisjon som overskriver ny plan.
