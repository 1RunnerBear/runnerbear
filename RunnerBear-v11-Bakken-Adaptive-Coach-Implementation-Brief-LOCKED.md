# RunnerBear v11 – Bakken Adaptive Coach Engine

**Status:** LÅST · godkjent for implementering og produksjonssetting

**Release:** 11.0.0

**Repository:** `1RunnerBear/runnerbear`

**Produksjon:** `app.runnerbear.workers.dev`

**Designgrunnlag:** RunnerBear Design Direction 1.0 · Concept 1 · Premium rolig

## 1. Målbilde

RunnerBear skal opptre som én adaptiv, Bakken-inspirert coach – ikke som en statisk malgenerator. Den kanoniske motoren skal velge ukens stimulus, øktfamilie og dose ut fra aktivt A-mål, B-løp, treningsfase, tilgjengelige treningsdager, nylig respons, helse/restitusjon og uforanderlig planhistorikk.

Feilen i v10.31.2, der begge foretrukne kvalitetsdager kunne ende som `5 × 1000 m · VO₂` gjennom index/paritetslogikk, fjernes. `5 × 1000 m` beholdes som en sjelden og bevisst kontrollert X-kandidat, og kan aldri være standard på begge kvalitetsdager.

## 2. Ufravikelige rammer

1. RunnerBear er fortsatt eneste sannhetskilde for planen.
2. Garmin er fortsatt registreringskilden; Tredict er fortsatt ti-dagers transport til Garmin.
3. Fullførte og importerte historiske data er uforanderlige. Regenerering skjer bare fremover fra I DAG.
4. Eksplisitte brukerlåser, løpslåser, manuelle flyttinger og aksepterte endringer vinner.
5. Komplette normaluker har to kvalitetsdoser med mindre løp, restitusjonsavstand, sykdom, skade eller eksplisitt sikkerhetsunntak forklarer et lavere antall.
6. Terskel er grunnstimuluset. X, VO₂ og løpsspesifikt arbeid velges bevisst, fasespesifikt og konservativt.
7. Rolig betyr rolig; ingen terskel-til-VO₂-glidning, skjult moderat trening eller treningsgjeld.
8. Et B-løp erstatter relevant kvalitetsdose i løpsuken og beskytter dagene rundt.
9. Safe-auto er reverserbar, versjonert, idempotent og begrenset til ulåst fremtidig trening.
10. Eksisterende v10.31.2-entrypoints og assets beholdes urørt for rollback.

## 3. Kanonisk coachsekvens

For hver fremtidig kvalitetsplass vurderer motoren i denne rekkefølgen:

1. Aktivt A-mål og måldistanse.
2. Dager til A-målet og nærmeste aktive B-løp.
3. Treningsfase: `BASE`, `BUILD`, `SPECIFIC`, `TAPER`, `RACE`, `TRANSITION`.
4. Ukens rolle: lang kontrollert terskel, kort kontrollert terskel, kontrollert X, løpsspesifikk eller løpserstatning.
5. Uke- og responsmodus: `BUILD`, `HOLD`, `REDUCE`, `RECOVERY`.
6. Harde avstandsregler mot kvalitet, langtur og løp.
7. Monotonivern: samme kvalitetsøkt gjentas ikke innen 14 dager med mindre den eksplisitt er en benchmark.
8. Kandidaten med lavest kostnad som bevarer tiltenkt stimulus.

Den deterministiske regel- og seleksjonsmotoren eier selve resepten. Det forklarende AI-laget kan forklare valget, men kan ikke omgå rammene eller finne opp en konkurrerende plan.

## 4. Bakken Quality Library

Det kanoniske biblioteket inneholder separate familier:

- Lang kontrollert terskel: `6 × 6 min`, `5 × 8 min`, `4 × 10 min`, `3 × 12 min`, `4 × 2000 m`.
- Kort kontrollert terskel: `24 × 45/15`, `15 × 1 min / 30 sek`, `12 × 400 m kontrollert`.
- Kontrollert X: `10 × 60 sek bakke`, `8 × 2 min kontrollert over terskel`.
- Sjelden VO₂: `5 × 1000 m · kontrollert VO₂` bare når fase, mål, respons og nylig historikk støtter det.
- Målspesifikt: kontrollerte halvmaraton-, 10 km- eller 5 km-økter valgt etter aktivt mål.
- Taper: flere reduserte terskelvarianter som bevarer rytme uten repetisjon innen 14 dager.

Hver valgt økt lagrer en forklarbar `plannedLoad.bakken` med motorversjon, økt-ID, fase, rolle, stimulus, begrunnelse, trygghet, årsakskoder og responsmodus.

## 5. Adaptiv responsloop

Tilbakemelding etter økten og neste morgen er kanonisk coach-evidens. Motoren vurderer kontroll, RPE, smerte, økt smerte, sykdom, stress, dårlig søvn, aktivitetsmatch og neste-dag-respons.

- Kontrollert og repeterbar respons: roter eller bygg innen tiltenkt stimulus med konservativ kostnad.
- Grensetilfelle eller høy kostnad: hold belastningen og velg en lavkost terskelvariant.
- Ukontrollert respons eller svært høy RPE: reduser neste ulåste kvalitetsdose med maksimalt 20 prosent og bevar terskel.
- Smerte eller sykdom: eksisterende sikkerhets- og needs-input-regler overstyrer progresjon.
- Tapt kvalitet: flyttes aldri blindt og skaper aldri treningsgjeld.

Samme evidenshendelse kan bare brukes én gang på en fremtidig kvalitetsøkt. Planrevisjonen er fremoverrettet, kan angres og projiseres til synk med samme stabile øktidentitet.

## 6. Release-reparasjon

Første produksjons-health kjører én idempotent v11-reparasjon av den aktive fremtidige planen:

- bevarer all historikk og alle låste rader;
- bevarer datoen på manuelle flyttinger og respekterer manuelle øktvalg;
- erstatter gamle standardresepter med v11-valg der motoren har eierskap;
- sikrer at normaluker ikke inneholder dobbel standard-VO₂;
- oppretter én samlet kanonisk planrevisjon;
- projiserer berørte økter til den varige Tredict-outboxen;
- viser reparasjon og Bakken-audit i `/health`.

Deploy avvises dersom v11-motor, historikkintegritet, D1, assets, Access, Tredict RPC, målvern eller Bakken-plan-audit ikke er frisk.

## 7. Brukeropplevelse

Eksisterende Premium rolig-design beholdes. Kvalitetsdetaljen og Quality Bank viser:

- hvorfor økten er valgt nå;
- fase og stimulus;
- hvordan siste respons påvirket dosen;
- intensitetsvern og stoppregel;
- forholdet til A-mål og B-løp;
- coachens trygghet.

Ingen ekstra dashboardstøy, maskot, neonstil eller konkurrerende coachflate innføres.

## 8. Akseptansekriterier

1. Tirsdag og torsdag kan ikke begge bli samme standardøkt `5 × 1000 m · VO₂`.
2. Alle automatisk genererte kvalitetsøkter har v11 Bakken-metadata og strukturert resept.
3. Minst én kontrollert terskeldose bevares i hver ordinære uke med to kvalitetsdoser.
4. VO₂/X velges aldri i transition/recovery og nedprioriteres etter negativ respons.
5. Samme økt gjentas ikke innen 14 dager med mindre den eksplisitt er en benchmark.
6. B-løp teller som kvalitetsdose og beskytter ukestrukturen.
7. Feedback kan endre neste ulåste fremtidige kvalitetsøkt én gang, uten å øke distanse eller endre historikk.
8. Eksisterende tester for planintegritet, målvern, historikk, safe-auto og ti-dagerssynk er grønne.
9. Nytt v11 Worker-entrypoint og kanoniske v11-assets deployes; v10.31.2 forblir urørt for rollback.
10. Produksjons-`/health` rapporterer `11.0.0`, `bakkenEngine: true`, frisk Bakken-plan-audit, intakt historikk og drenert ikke-review synk.
