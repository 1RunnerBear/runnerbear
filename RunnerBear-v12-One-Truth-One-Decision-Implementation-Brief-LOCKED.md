# RunnerBear v12.0 — One Truth · One Decision

Status: **LOCKED**  
Designretning: **Concept 1 · Premium rolig**  
Låst: 2026-09-02

## Produktløfte

RunnerBear skal vise én verifisert plan og gi ett sammenhengende råd. Brukeren skal aldri måtte avgjøre hvilken plan, status eller anbefaling som er riktig.

## Ikke-forhandlingsbare kontrakter

1. **Én sannhet:** Den aktive kanoniske planrevisjonen er eneste autoritet. Historiske og inaktive revisjoner kan leses, men aldri blandes inn i gjeldende plan eller synkroniseres.
2. **Én beslutning:** Dagens økt, kroppens respons og ukens prioritet skal presenteres som én konsistent beslutning. Støttesignaler kan forklare beslutningen, men ikke konkurrere med den.
3. **Kontrollert endring:** AI kan foreslå, men ikke skrive direkte til planen. Brukeren ser før/etter og bekrefter. Trygg autopilot er begrenset til policygodkjente reduksjoner på maksimalt 20 %, med historikk og angremulighet.
4. **Én runtime-eier:** Canonical v2-bootstrap eier plan, helsedata og aktiviteter. Legacy-klienten beholder kun migrering, lokal state-upload og kompatibilitetstransport; den skal ikke utføre en parallell bootstrap eller bakgrunnssynk.
5. **Concept 1:** Rolig hierarki, varm nøytral flate, presise kort, én primær handling per flate, ingen dekorativ støy og ingen motstridende statusfarger.

## Implementeringsomfang

- En felles releasekilde for klient, UI, servermetadata og cacheversjon.
- Fail-closed integritetskontroll av planrevisjon, status, workout-ID-er og dato/slot-identitet før hydrering.
- Normalisert shadow-paritet innenfor aktiv planhorisont, med nyttige differanser og uten falsk alarm etter canonical cutover.
- Canonical-only oppstart i Cloud: ingen `/api/bootstrap/home`, ingen ekstra full-bootstrap og ingen femminutters klientsynk når v2-runtime finnes.
- Samordnet «One Decision»-presentasjon på I dag og korrekt status på ukens prioritet.
- Månedsoversikt lukket som standard; ukeplanen er første arbeidsflate.
- Tydeligere ukestatistikk og responsivt premium desktop-oppsett.
- Korrekte immutable-cache-regler for gjeldende assets og no-cache for release-/manifestmetadata.
- Atferdstester for planintegritet, beslutningskonsistens, canonical oppstart, versjon og cache.

## Akseptansekriterier

- Nøyaktig én aktiv planrevisjon kan installeres i klientens read model.
- Revision-ID i bootstrap, activePlan og alle revisionbundne modeller må være identisk.
- Duplikat `workoutId` eller identisk dato/slot avvises før første paint.
- Canonical Cloud-oppstart gjør én v2-bootstrap og null legacy-bootstrap-kall.
- Normal helse + justeringsforslag forklares uten å fremstilles som en helsemotsigelse.
- «Handling kreves» vises bare når dagens beslutning faktisk venter på brukerhandling.
- Månedsoversikten åpnes eksplisitt og har korrekt `aria-expanded`/`aria-controls`.
- UI, manifest, genererte bundles, server og releasefil rapporterer 12.0.0.
- Bygg er deterministisk; hele testsuiten er grønn; ingen nye nettleserfeil i verifisert runtime.

## Utenfor v12.0

- Nye treningsfilosofier eller endring av Bakken-prinsippene.
- Automatisk sletting av brukeropprettede Tredict-økter.
- Blanket cleanup av kalender, aktivitetshistorikk eller planrevisjoner.
- Nye toppnivåfaner eller en separat helsedashboard.
