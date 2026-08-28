# RunnerBear 11.1.0 — Body Response

## Én coach, ett helsegrunnlag

- Bakken Adaptive Coach bestemmer fortsatt hvordan det trenes. Body Response bestemmer hvor mye av den planlagte dosen kroppen bør få i dag.
- HRV, hvilepuls, søvn, faktisk belastning og egenfølelse vurderes i fem domener. HRV og hvilepuls ligger i samme autonome domene og kan derfor ikke dobbelttelles.
- Ett isolert lavt HRV-signal gir «følg med», ikke planendring. Reduksjon krever minst to uavhengige domener eller et vedvarende autonomt avvik.
- Positive signaler kan aldri øke planlagt dose. Automatisk reduksjon er fortsatt avgrenset til maksimalt 20 prosent og bruker eksisterende Coach Loop-revisjon, sikkerhetspolicy og angremulighet.
- Sykdom og smerte behandles som sikkerhetssignaler som krever et eksplisitt valg, aldri som en medisinsk diagnose.

## Concept 1-opplevelse

- «Kroppens respons» er integrert i `I dag`; det er ikke opprettet en konkurrerende helsefane.
- Det kompakte kortet viser dagens konklusjon, nattens HRV/søvn/hvilepuls, datakvalitet og status for personlig normal.
- Det tilgjengelige detaljarket viser natt, 7 dager og 28 dager, de fem domenene og en kort kroppssjekk bare når data mangler eller spriker.
- Ingen 0–100-score, alarmistiske farger, medisinske påstander eller nytt designspråk er introdusert. Flaten følger låst Concept 1 / Design Direction 1.0.

## Produksjonsarkitektur

- `body-response-1` er en deterministisk, serverautoritativ motor knyttet til gjeldende `planRevisionId` og `inputCursor`.
- Bootstrap leverer atomisk `bodyResponse`, `healthSummary`, `baselineStatus` og `healthDataFreshness` sammen med coachbeslutningen.
- Nye endepunkter: `GET /api/v2/health/detail` og idempotent `POST /api/v2/check-ins`.
- D1-migrering `0007_body_response.sql` er additiv og introduserer proveniensdata, robuste baseline-snapshots, revisjonsbundne Body Response-snapshots, subjektive innsjekker, neste-dagskoblinger og læringsinnsikt.
- Produksjons-`/health` krever schema v3, `bodyResponseEngineVersion: "body-response-1"` og seks verifiserte Body Response-tabeller, samtidig som Bakken-, historikk-, synk- og tilgangsportene beholdes.

## Faglig oversettelse til produkt

- Individuell trend prioriteres foran befolkningsgrenser. Dette følger anbefalingene om individualisert og konsistent HRV-monitorering i utholdenhetsidrett fra [Plews et al.](https://pubmed.ncbi.nlm.nih.gov/23852425/), [Buchheit](https://pubmed.ncbi.nlm.nih.gov/24578692/) og den nyere praksisgjennomgangen til [Lundstrom et al.](https://pubmed.ncbi.nlm.nih.gov/35853460/).
- HRV brukes som styringssignal med konservativ terskel og aldri alene som diagnose eller prestasjonsløfte. Dette er i tråd med funnene i [systematisk oversikt over HRV-styrt trening](https://pmc.ncbi.nlm.nih.gov/articles/PMC8507742/) og et [randomisert forsøk i profesjonelle løpere](https://pubmed.ncbi.nlm.nih.gov/34813821/).
- Søvn vurderes først mot individuell normal og sammen med øvrige signaler. En konservativ kort-søvn-sperre brukes bare som brems, ikke som prestasjonsfasit, i tråd med [ekspertkonsensus om søvn hos utøvere](https://bjsm.bmj.com/content/55/7/356).

Forskningen informerer beslutningsrammen; RunnerBear er fortsatt en treningsapp og ikke et medisinsk verktøy.
