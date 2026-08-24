# RunnerBear 10.31.2

## Målvern og B-løp

- «Bygg form uten løpsdato» krever nå en egen, tydelig bekreftelse før A-målet pauses.
- Det sist utilsiktet pauserte fremtidige A-målet reaktiveres automatisk én gang, med måltid og B-løp bevart.
- B-løp er nå del av den kanoniske planrevisjonen og erstatter én kvalitetsdose i aktuell løpsuke.
- Uken før et løp tidlig i neste uke reduseres til én kvalitetsdose, slik at restitusjonsavstanden og rullerende kvalitetstak beholdes.
- Den stabile B-løpsidentiteten gjør at Tredict/Garmin justerer samme økt ved planendringer, i stedet for å opprette et parallelt frontend-løp.

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
