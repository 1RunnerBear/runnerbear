# RunnerBear 10.30 – proaktiv coachbrief (LOCKED)

Status: Godkjent for implementering 24. august 2026  
Designretning: RunnerBear Design Direction 1.0 / Concept 1 / Premium rolig  
Leveranse: kildekode, tester, GitHub PR/merge og produksjonsdeploy

## 1. Mål

RunnerBear skal gjøre coachens vurdering lettere å forstå og handle på uten å gjøre appen mer støyende. Brukeren skal alltid kunne svare på tre spørsmål:

1. Hva gjør jeg i dag?
2. Hvorfor er dette riktig nå?
3. Hva følger coachen med på, og hva kan endres videre?

Løsningen skal være deterministisk og serverautoritativ. Den skal ikke bruke generativ tekst eller etablere en ny, konkurrerende sannhet ved siden av aktiv plan og aktiv coachbeslutning.

## 2. Omfang

### A. Kanonisk coachbrief

Bootstrap API-et skal levere `coachBrief`, bygget fra samme `planRevisionId`, `inputCursor` og gyldighetsvindu som den aktive coachbeslutningen.

Briefen skal inneholde:

- `today`: dagens konkrete handling, begrunnelse og berørt økt
- `week`: ukens prioritet, hvorfor den prioriteres, neste nøkkeløkt og hva som kan endres
- `freshness`: om vurderingen er gjeldende eller må fornyes
- `nextReviewAt`: når signalene senest må vurderes på nytt
- `keyWorkoutIds`: hvilke kommende nøkkeløkter vurderingen beskytter

Ved manglende, utløpt eller feil planrevisjon skal briefen være avventende. Den skal aldri presentere en eldre beslutning som gjeldende.

### B. Ukens prioritet på I dag

En kompakt coachmodul skal vises etter dagens coachvurdering:

- én tydelig prioritet
- én kort forklaring
- neste nøkkeløkt eller neste vurderingspunkt
- et rolig statusnivå: normal, følg med eller handling kreves

Normaltilstanden skal være kompakt. Mer forklaring åpnes ved behov.

### C. Forklaring av planendringer

«Hvorfor denne økten?» skal forklare:

- hvilken coachbeslutning som gjelder
- hvilke signaler som støtter den
- om planen faktisk er endret
- hvilke økter som berøres
- hva som skjer med resten av uken
- når vurderingen fornyes

Hvis ingen planendring er gjort, skal dette sies eksplisitt.

### D. Konkrete coachhandlinger

Coachbriefen skal peke på neste handling, men bare eksisterende kanoniske beslutningsflyt får endre planen.

- `keep`: følg dagens økt
- `reduce`, `replace`, `move`, `rest`, `replan`: bruk eksisterende forslag/aksept-flyt
- `wait_for_data`: behold planen og oppdater datagrunnlaget
- `needs_input`: be om ett avgrenset valg

Ingen handling skal automatisk opprette treningsgjeld eller omskrive historikk.

### E. Forklaringer under Mot målet

De fire statusrutene under «Mot målet» skal være tilgjengelige knapper som åpner en modal for:

1. hovedmålet
2. 5 km-form
3. retning
4. neste gate

Hver forklaring skal vise:

- hva statusen betyr
- hvilket datagrunnlag som brukes
- hva som kan forbedre statusen
- hvilken praktisk konsekvens den har for planen

«Krever tydelig framgang» skal forklare at dagens kapasitetsbilde ikke støtter måltiden ennå, omtrent hvilket gap som gjenstår når datagrunnlaget tillater det, og at planen utvikler kapasitet uten å jage fart eller skape treningsgjeld.

## 3. Autoritet og datakontrakt

`coachBrief` er en avledet lesemodell. Den kan ikke mutere plan, beslutning eller synkstatus.

Minimumskontrakt:

```json
{
  "version": "coach-brief-1",
  "planRevisionId": "pr-…",
  "inputCursor": "…",
  "generatedAt": "ISO-8601",
  "validUntil": "ISO-8601",
  "freshness": "current | stale | unavailable",
  "attention": "normal | watch | action",
  "today": {
    "workoutId": "wo-…",
    "title": "…",
    "summary": "…",
    "actionKind": "keep",
    "actionLabel": "Følg dagens økt"
  },
  "week": {
    "priority": "…",
    "reason": "…",
    "nextChange": "…",
    "nextKeyWorkout": {},
    "keyWorkoutIds": []
  }
}
```

## 4. Ufravikelige plan- og synkregler

- Fullførte, importerte og historiske økter er uforanderlige.
- Replanlegging gjelder bare fra dagens dato og fremover.
- Treningsstimulus bevares; tapte økter blir ikke treningsgjeld.
- Maks to kvalitetsøkter i rullerende sju dager.
- Ingen kvalitetsøkter på nabodager.
- Kvalitet og langtur skal ha trygg avstand.
- Helse- og sikkerhetssignaler vinner over måltempo og preferanser.
- Endrede løpedager, kvalitetsdager og langturdag påvirker bare fremtidige økter.
- Tredict/Garmin-projeksjonen beholder stabil `workoutId` og planrevisjon, er idempotent, har én aktiv Tredict-økt og lar aldri en gammel jobb overskrive en nyere revisjon.
- Synkhorisonten er fortsatt ti dager. Detaljer skjules når alt er normalt og vises når handling kreves.

## 5. Brukeropplevelse og tilgjengelighet

- Behold fire hovedfaner og eksisterende visuell retning.
- Ingen maskot, neon, emoji-UI eller redesign.
- Dialoger skal ha `role="dialog"`, navn, modal semantikk, Escape-lukking, bakgrunnslukking og tydelig fokusmål.
- Alle interaktive flater skal være tastaturtilgjengelige og minst 44 px høye/brede.
- Coachstatus skal ikke kommuniseres med farge alene.
- Popup for mål skal ligge over eksisterende visning og aldri bak en annen modal.

## 6. Akseptansekriterier

Leveransen er godkjent når:

1. API-et returnerer en revisjonsbundet og TTL-bundet `coachBrief`.
2. Utløpt eller feilrevidert beslutning kan ikke vises som gjeldende.
3. I dag viser én forståelig ukesprioritet med hvorfor og neste steg.
4. «Hvorfor denne økten?» sier tydelig om planen er endret eller ikke.
5. Alle fire målstatusene åpner egne forklaringer.
6. Forklaringen av «Krever tydelig framgang» er konkret uten falsk presisjon.
7. Ingen eksisterende plan-, historie- eller synkinvariant svekkes.
8. Enhets-, integrasjons-, UI-, tilgjengelighets- og produksjonshelsetester er grønne.
9. Endringen er pushet, gjennomgått i PR, merget til `main`, deployet og visuelt verifisert i produksjon.

## 7. Utenfor denne leveransen

- fri chat eller generativ AI-coach
- nye eksterne datakilder
- endring av Tredict/Garmin-transportarkitektur
- nytt navigasjonsmønster
- automatisk behandling av sykdom eller skade uten brukeravklaring

