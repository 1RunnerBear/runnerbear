# RunnerBear 10.31 – ukereview, realignment og synkreparasjon (LOCKED)

Status: Godkjent for implementering 24. august 2026
Designretning: RunnerBear Design Direction 1.0 / Concept 1 / Premium rolig
Leveranse: kildekode, tester, GitHub PR/merge og produksjonsdeploy

## 1. Mål

RunnerBear skal lukke coachsløyfen fra gjennomført uke til neste trygge plan. Appen skal:

1. oppsummere hva som faktisk skjedde forrige uke og hva coachen tar med videre,
2. vurdere planen automatisk etter en tapt økt, eksplisitt meldt sykdom eller alternativ trening,
3. endre bare fremtiden, uten treningsgjeld eller stimuli-glidning,
4. gjøre Tredict/Garmin-konflikter forståelige og reparerbare uten teknisk diagnostikk i normalflyten.

RunnerBear er fortsatt eneste sannhetskilde. Tredict er transport til Garmin-kalenderen; Garmin er aktivitets- og helsekilde.

## 2. Kanoniske kontrakter

### A. `weeklyReview`

Bootstrap skal levere en deterministisk, revisjonsbundet lesemodell for siste avsluttede kalenderuke:

- planlagt og gjennomført løpsvolum,
- planlagte, gjennomførte, erstattede og tapte økter,
- kvalitetsøkter og langtur som faktisk ble absorbert,
- alternativ trening som aerob støtte uten falske løpskilometer,
- tydelig hovedlæring,
- konkret konsekvens for inneværende og neste uke,
- datakvalitet og hvilke kilder vurderingen bygger på.

Reviewen skal aldri tolke manglende data som gjennomføring. Usikker matching merkes som usikker og endrer ikke plan alene.

### B. `realignmentProposal`

Bootstrap og hendelsesrespons skal kunne levere ett aktivt fremoverrettet forslag med:

- trigger: `missed_workout | illness_reported | alternative_training`,
- berørt planrevisjon og inputcursor,
- vurdert tidsvindu,
- planstatus: `unchanged | proposed | applied | needs_input`,
- før/etter for berørte fremtidige økter,
- beskyttede nøkkeløkter og stimuli,
- begrunnelse, treningsgjeldstatus og Angre-vindu.

Samme input mot samme aktive revisjon skal være idempotent. En eldre proposal kan aldri anvendes på en nyere planrevisjon.

### C. `syncRepair`

Synkstatus skal grupperes til én handlingsmodell:

- `healthy`: alt bekreftet eller ingen relevant jobb,
- `processing`: serveren arbeider eller prøver igjen,
- `activation_required`: planen må opprettes/aktiveres i Tredict,
- `source_missing`: Tredict finner ikke forventet gammel økt,
- `structural_review`: flytting, erstatning eller kansellering må verifiseres,
- `terminal`: handlingen kan ikke repareres automatisk.

Modellen skal vise hvilken økt og dato som er berørt, hva RunnerBear allerede har lagret, nøyaktig neste brukerhandling og en eksplisitt «Kontroller på nytt»-handling.

## 3. Ukereview i brukerflaten

På `I dag`, etter ukens prioritet, vises en kompakt modul «Forrige uke» med:

- én hovedkonklusjon,
- gjennomført mot planlagt volum,
- nøkkeløkter gjennomført/erstattet/tapt,
- én setning om hva dette betyr for planen fremover.

«Se ukereview» åpner et tilgjengelig modalark med fire seksjoner: gjennomført, tilpasset, læring og neste retning. Modalen følger eksisterende Escape-, bakgrunns-, fokus- og 44 px-regler.

## 4. Automatisk fremoverrettet realignment

### Tapt økt

- Den tapte dagen og historikken endres aldri.
- Rolig støtteøkt tas normalt ikke igjen.
- Tapt kvalitet flyttes aldri blindt.
- Neste planlagte kvalitet beskyttes når den ligger trygt; ellers produseres et revisjonsbundet forslag.
- Manglende kilometer presses ikke inn senere i uken.

### Sykdom

- Bare eksplisitt meldt sykdom kan utløse automatisk sykdomsrealignment.
- Passive HRV-/søvnavvik alene kan bremse eller foreslå, men skal ikke klassifisere sykdom.
- Løping i et avgrenset 72-timers sikkerhetsvindu erstattes med hvile; løp og systemlåste økter krever eksplisitt valg.
- Etter sikkerhetsvinduet står planen uten volumgjeld og vurderes på nytt ved friskmelding eller nye data.

### Alternativ trening

- Matchet Concept2/sykkel kan erstatte planlagt aerob støtte.
- Alternativ aktivitet gir aerob kostnad, men null løpsmekanisk volum.
- Kvalitetsstimulus regnes ikke som gjennomført av alternativ trening uten eksplisitt coachbeslutning.
- Neste hardøkt kan beskyttes eller flyttes når faktisk belastning og avstand krever det.

### Automatikk og Angre

- Automatisk anvendelse krever aktiv canonical write, sync og safe-auto.
- Maks fire fremtidige økter kan berøres i én automatisk realignment.
- Ingen doseøkning, ingen endring av løp/systemlås, ingen terskel→VO₂/X-konvertering og ingen historikkmutasjon.
- Alle anvendte realignments lager én atomisk planrevisjon, én hendelse, én synk-outbox og ett synlig Angre-punkt.

## 5. Tredict/Garmin konflikt- og reparasjonsflyt

- Normal synkstatus forblir rolig og kompakt.
- Ved konflikt vises én samlet reparasjonsmodul i Plan og Mer.
- RunnerBear skiller mellom automatisk retry og handling som faktisk må gjøres i Tredict.
- «Kontroller på nytt» verifiserer også kansellering og erstatning; cron skal ikke repetere destruktive review-operasjoner automatisk.
- En ny planrevisjon superseder alltid eldre, uavklarte jobber.
- Repareringsforsøk er idempotente og kan ikke gjenopplive en eldre revisjon.
- UI sier «Bekreftet i Tredict · Garmin følger kalenderen» og påstår aldri direkte Garmin Training API-skriving.

## 6. Dataintegritet og sikkerhet

- Historiske, fullførte og importerte rader er byte-for-byte/logisk uforanderlige.
- Alle datoavgjørelser bruker utøverens `Europe/Oslo`-tidssone.
- Maks to kvalitetsøkter i rullerende sju dager.
- Ingen harde nabodager; trygg avstand mellom kvalitet og langtur.
- Ukevolum er mål, aldri gjeld.
- Stabil `workoutId`, `lineageId`, planrevisjon og idempotency key beholdes gjennom projeksjonen.
- Gamle syncjobber kan ikke overskrive aktiv revisjon.
- Ingen generativ tekst eller konkurrerende klientautoritet introduseres.

## 7. Observability

Strukturerte hendelser skal dekke:

- `coach_weekly_review_built`,
- `coach_realign_evaluated`,
- `coach_realign_applied`,
- `coach_realign_no_change`,
- `sync_repair_presented`,
- `sync_repair_verified`,
- `sync_repair_still_required`.

Loggene skal inneholde build, policyversjon, brukeromfang, planrevisjon, trigger/reason code og korrelasjons-ID, men ingen sensitive helseverdier.

## 8. Akseptansekriterier

Leveransen er godkjent når:

1. `weeklyReview` er revisjonsbundet, kildebevisst og forklarer konsekvensen fremover.
2. Tapt rolig økt skaper ingen treningsgjeld eller historikkendring.
3. Tapt kvalitet flyttes ikke blindt og stimuli-lock bevares.
4. Eksplisitt sykdom gir et avgrenset, fremoverrettet restitusjonsvindu uten doseøkning.
5. Alternativ aktivitet får aerob, men ikke mekanisk løpskreditt.
6. Realignment er idempotent, CAS-beskyttet, atomisk og kan angres.
7. Synkreparasjon skiller retry, Tredict-aktivering, manglende kilde og strukturell kontroll.
8. Eksplisitt kontroll kan bekrefte manuelt reparerte cancel/replace-operasjoner; cron gjør det ikke destruktivt.
9. Alle eksisterende plan-, historikk-, stimulus-, volum- og synkinvarianter forblir grønne.
10. Enhets-, integrasjons-, UI-, tilgjengelighets-, build- og produksjonshelsetester er grønne.
11. Endringen er pushet, gjennomgått i PR, merget til `main`, deployet og produksjonsverifisert.

## 9. Utenfor 10.31

- fri chat eller generativ coach,
- diagnose eller medisinsk behandling,
- automatisk skadehåndtering uten eksplisitt brukerinput,
- direkte Garmin Training API-integrasjon,
- redesign av hovednavigasjon eller RunnerBear Design Direction 1.0.
