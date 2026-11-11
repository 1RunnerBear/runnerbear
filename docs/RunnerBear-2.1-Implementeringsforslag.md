# RunnerBear 2.1 – tydelig innsikt og raskere flyt

**Dato:** 11. november 2026
**Status:** Implementeringsforslag til godkjenning. Ikke implementert eller deployet.
**Omfang:** Én samlet UX-, feilrettings- og ytelsesoppdatering på toppen av RunnerBear 2.0. «2.1» er foreslått produktnavn; teknisk versjon fastsettes ved implementering.

## 1. Beslutningen

Videreutvikle det låste Original A-designet uten en ny designrunde. Appen skal først og fremst forklare hva treningen og helsedataene forteller, og gjøre neste handling enkel. Planlegging og øktforslag skal støtte denne opplevelsen.

Behold fire hovedområder: **I dag, Trening, Helse og Mål**, med profil og innstillinger tilgjengelig separat. Behold varm, lys bakgrunn, grønne aksenter, tydelig typografi og den rolige coachstemmen. Viderefør mørk visning med like god lesbarhet.

Oppdateringen prioriterer:

1. Presis og forståelig tilbakemelding etter trening.
2. Helsedata som forklarer både målinger, datadekning og vurderingsgrunnlag.
3. Stabil og rask navigasjon, også når et API bruker lang tid eller feiler.
4. Produksjonskontroll som tester det brukeren faktisk åpner.

Ingen ny chat, hovedfane, manuell synkronisering eller omfattende omskriving inngår.

## 2. Utgangspunkt og avgrensning

Gjeldende produksjonsrelease er runtime 13.0.0 med det nye designet og lesende innsiktsflater. Produksjonsløp 43025269093 ble grønt, og I dag, Helse og søvnpust ble kontrollert i den autentiserte appen etter rettingen. Helsefeilen skyldtes at endepunktene lå i en historisk ruter, mens den aktive Worker-ruteren manglet dem.

Dette betyr at presentasjonslaget er publisert. Det betyr ikke at hele den langsiktige Coach Intelligence-briefen er ferdig validert. Presise løpsprognoser, personlig responslæring og utvidet automatikk behandles som egne leveranser med egne datakrav.

Direkte Garmin-målinger kan fortsatt vises som observerte data uten å bli ny autoritativ kilde for planendringer. Eksisterende planrevisjoner, kildeansvar og grenser for automatisk endring skal bevares.

## 3. Leveransen, skjerm for skjerm

| Område | Problem eller situasjon | Endring | Akseptansekriterium |
|---|---|---|---|
| I dag | Flere forbehold og ventetekster konkurrerer med siste økt | Én hovedinnsikt, én hovedhandling og kompakt støttestatus | På 390 × 844 vises hovedinnsikt og handling uten scrolling ved normal tekststørrelse; større tekst fungerer uten avkapping |
| Øktanalyse | Registrerte arbeidssegmenter kan oppfattes som bekreftede intervaller | Skill ramptest, sammenhengende økt, intervalløkt og ukjent struktur | Ramptest blir ikke vurdert som terskelintervaller eller brukt til automatisk FTP-endring |
| Helse | Målinger finnes, mens samlet coachvurdering avventer annet grunnlag | Vis målingstidspunkt, dekning og vurderingsstatus tydelig hver for seg | Brukeren kan se hva som er mottatt og hva som eventuelt mangler, uten tekniske kildekoder |
| Helse ved venting/feil | Ny forespørsel kan tømme innhold eller avsluttes sent | Avbryt erstattede kall, begrens ventetid og bevar gyldig innhold | Sen respons fra forrige periode kan aldri overskrive aktiv periode |
| Mål / Din form | Flere distanser gjentar «Ikke sikkert nok» | Én samlet forklaring og nyttig, dokumenterbar formutvikling | Ingen oppdiktede løpstider; mål er valgfrie |
| Navigasjon | Ny rendering kan flytte fokus eller lukke detaljer | Bevar valg, fokus og relevant skjermtilstand | Periode, valgt måling og tilbakeflyt fungerer konsekvent |

### I dag: raskt frem til det som betyr noe

Prioriter nylig gjennomført økt når den gir den mest relevante tilbakemeldingen. En aktuell, dokumentert helsevurdering kan fortsatt få høyere prioritet. Gammel datostatus alene skal ikke bli en dramatisk helseadvarsel.

Øktkortet skal svare på: **Hva fikk jeg gjort, hva kan vi si om det, og hva bør jeg åpne videre?** Hovedhandlingen er normalt «Se øktanalysen». Plan og ukereview er sekundære.

Generiske kort om at en review «bygges» flyttes til kompakt status eller utelates når de ikke gir brukeren en handling eller innsikt. Vis aldri en ferdig vurdering før grunnlaget finnes. Detaljert kildeinformasjon kan ligge under en forklaring.

### Trening: forklar økten med riktig språk

Første del av analysen viser faktisk gjennomført arbeid, relevant graf og korte funn. Totaler og kobling mot plan ligger under. Økter uten planmatch skal fortsatt ha en selvstendig analyse og merkes forståelig; manglende kobling skal ikke bli en påstand om en tapt planøkt.

Skill mellom:

- **Ramptest:** Forklar testen og registrert effektutvikling. Gjennomsnittseffekt er ikke FTP.
- **Intervaller:** Vis bekreftede arbeidsdrag og pauser når datagrunnlaget støtter det.
- **Sammenhengende økt:** Vis utvikling gjennom økten uten å konstruere intervaller.
- **Ukjent struktur:** Vis registrerte runder/segmenter og begrens konklusjonen.

En graf basert på rundesnitt skal hete rundesnitt. Sekundkurver vises bare når slike data finnes. Enheter og retning for tempo må være forståelige. Manglende watt er ikke null watt; målt null beholdes. Brukerens tempokorreksjon skal ikke overskrive originalmålingen.

### Helse: tydelig skille mellom måling og vurdering

Øverst vises en kort oppsummering, målingstidspunkt og datadekning. Deretter én valgt måling og graf, med forklaring i nærheten. Mer omfattende kildebeskrivelse flyttes til tilgjengelige detaljer.

Eksempel på tilstand, bare når den støttes av faktiske data: «Målinger mottatt for 7 av 7 dager. Samlet vurdering avventer oppdatert grunnlag.» Bruk tidspunkt for siste måling, ikke tidspunktet siden ble åpnet, som bevis på ferskhet.

Periodevalg beholdes: helse 7/28/90 dager, søvnpust 7/30/90 netter. Median, gjennomsnitt og laveste registrerte verdi skal merkes riktig. Ingen data, delvis dekning og teknisk feil får forskjellige tilstander. Søvnpust viser observerte nattverdier og sensorbegrensninger; SpO₂ brukes ikke til å beregne pustestopp eller stille diagnose.

### Mål: vis form uten å kreve et konkurransemål

Når løpsprognosen mangler tilstrekkelig grunnlag, vis én felles forklaring fremfor tre like ventefelt. Vis tilgjengelig utvikling i treningskontinuitet og sammenlignbare økter, med periode og kildegrunnlag. Påstander om fremgang krever sammenlignbare data; ellers beskrives bare hva som er registrert.

Skill løpsspesifikk kapasitet og mekanisk løpsbelastning fra aerob trening på sykkel og romaskin. Ikke oversett sykkelwatt direkte til en tilsynelatende presis halvmaratontid. Personlige mål forblir valgfrie.

## 4. Tekniske arbeidspakker

| Prioritet | Arbeid | Primære kodeområder | Ferdig når |
|---|---|---|---|
| P0 | Sikre aktiv helseruting og felles handler | `cloud/runnerbear-cloud/src/v11/routes.js`, `src/v1027/health-intelligence.js` | Tester går gjennom konfigurert Worker-entrypoint og fanger manglende autentiserte helseruter |
| P0 | Robust forespørsels- og tilstandshåndtering | `runnerbear-v20-health.js` | Avbrudd, timeout, samtidige kall, cache og periodebytte er kontrollert |
| P1 | Øktstruktur og tydeligere analyse | `runnerbear-v20-intelligence.js`, `runnerbear-ui-v11-source.js` | Ramptest, intervaller og ukjent struktur presenteres korrekt |
| P1 | Prioritering på I dag og nyttigere Din form | `runnerbear-ui-v11-source.js` | Én hovedhandling og færre gjentatte forbehold, med ærlig datagrunnlag |
| P1 | Konsistens, mobil og tilgjengelighet | `runnerbear-v20-editorial.css`, `runnerbear-v20-health.css` og delte UI-komponenter | Lesbarhet, fokus, tilbakeflyt og berøringsflater fungerer på tvers av fanene |
| P1 | Målrettet ytelsesarbeid | `runnerbear-cloud-v11.js`, helseutvidelse og eksisterende byggsystem | Målt flaskehals er redusert uten ny synkroniseringseier eller funksjonsregresjon |

Genererte JS- og CSS-bundler bygges fra eksisterende kilder og manifest. Historiske inngangsfiler og rollbackreferanser omskrives ikke for å rydde kosmetisk. Aktiv og historisk helseruting skal ikke videreutvikles som to separate implementasjoner; eventuell konsolidering må bevare historiske referanser og kompatibilitet.

### Forespørsler og cache

Cache-nøkkel skal inkludere endepunkt/visning, periode og relevant kildeversjon. Data fra oversikt og søvnpust må aldri blandes bare fordi begge bruker 7 eller 90 dager. Slå sammen samtidige identiske kall. Avbryt forespørsler som er erstattet, og behold kontrollen som hindrer gamle svar i å overta.

Vis sist gyldige data under oppfriskning av samme visning og periode, med korrekt tidsmerking. Ved periodebytte skal gammelt innhold ikke feilmerkes som den nye perioden. Innfør en avgrenset ventetid, foreslått 12 sekunder, og en lokal «Prøv igjen»-handling ved feil. Dette er ny henting av visningen, ikke en manuell Garmin-synkronisering.

Bevar fokus og åpne detaljer når bakgrunnsdata oppdateres. Ikke erstatt hele siden med en ny HTML-streng når en mindre oppdatering er tilstrekkelig.

## 5. Ytelse: mål før og etter

Følgende er **akseptansemål**, ikke allerede målte produksjonsresultater:

- Registrer kald og varm åpning av I dag, tid til nyttig innsikt, fanebytte, API-tider, antall kall og overførte byte.
- Bruk samme enhet, nettprofil, datagrunnlag og minst 20 gjentakelser per scenario. Rapporter median og p95. Små utvalg beskrives som indikative.
- Reduser p95 med minst 20 % i den prioriterte, påviste flaskehalsen. Andre hovedflyter skal ikke bli mer enn 10 % tregere uten en konkret begrunnelse.
- Ved gyldig cache skal fanens nyttige innhold vises innen 200 ms på valgt referanseenhet.
- Unngå synlig layoutforskyvning; mål CLS ≤ 0,05 for de testede skjermflytene.
- Ingen doble samtidige kall for samme helseressurs og periode. Ingen ekstra full bootstrap når eksisterende data dekker visningen.

Utsett rendering av inaktive flater, oppdater bare nødvendige elementer og gjenbruk eksisterende dataløp. Ikke innfør et nytt rammeverk eller en ny database for denne pakken. Hvis målingen ikke viser en reell flaskehals, dokumenteres det fremfor å gjøre spekulative endringer.

## 6. Verifikasjon og produksjonskrav

| Kontroll | Dekning |
|---|---|
| Aktiv API-integrasjon | Autentiserte kall gjennom faktisk Worker-entrypoint til helsetrender og søvnpust, med representative lokale D1-fixtures |
| Perioder og feil | Helse 7/28/90, søvnpust 7/30/90; ingen data, delvise data, feil, timeout og svar i feil rekkefølge |
| Øktanalyse | Ramptest, løpsintervaller, sammenhengende løp, sykkel, roing, ukjent struktur, manglende måling og registrert null |
| Mobil og tilgjengelighet | Smal mobil, vanlig mobil og desktop; lys/mørk visning, forstørret tekst, tastatur, fokus, redusert bevegelse og minst 44 px berøringsmål |
| Regresjon | Planhistorikk, én aktiv planrevisjon, kilde-ID-er, rettigheter og eksisterende grenser for automatikk |
| Produksjon | I dag, siste øktanalyse, Helse, søvnpust og Mål åpnes autentisert og viser forventet data/tilstand |

Eksisterende relevante tester kjøres, supplert med tester av faktisk atferd. En offentlig `/health`-respons, en innloggingsredirect eller en nettlesertest med bare simulerte 200-svar er ikke tilstrekkelig bekreftelse på at helseskjermen virker.

Privat produksjonsinnhold skal ikke dumpes som testdatasett. Bruk lokale fixtures og begrenset kontroll av nødvendige skjermbilder/endepunkter. Den separate valideringen av minst 20 reelle økter på tvers av idretter og 14 operative observasjonsdager forblir egne porter for videre intelligens og automatikk. Historiske helsedager teller ikke som operative observasjonsdager.

## 7. Gjennomføring og deploy

1. Registrer baseline og bekreft releasekilde. Avklar konkrete flaskehalser fra målinger.
2. Gjennomfør P0: aktiv rutetest, forespørsler, cache og feiltilstander.
3. Gjennomfør P1: øktanalyse, I dag, Helse, Din form og visuell konsistens.
4. Bygg genererte filer, kjør relevante regresjonstester og kontroller representative mobilflyter. Sammenlign ytelse mot baseline.
5. Publiser én samlet release gjennom eksisterende GitHub/Cloudflare-løp. Behold kontrollert DB-binding-fallback for den kjente 10021-feilen; andre feil skal fortsatt stoppe deploy.
6. Kontroller autentiserte produksjonsflyter og API-responser. Bekreft at klient og Worker hører til samme release, og at vanlig gjenåpning av appen henter riktig versjon.
7. Oppdater hovedbriefen med commit, produksjonsversjon, måleresultater, kontroller og eventuelle gjenstående punkter.

Ingen skjemaendring forventes. Dersom implementeringen viser et reelt behov, skal migrering være additiv og inngå i ordinær backup- og migreringskontroll.

**Rollback:** Behold forrige verifiserte Worker-versjon og tilhørende klientartefakter. Ved brudd i autentisert datalasting, planhistorikk eller sentrale mobilflyter rulles begge tilbake som et kompatibelt sett. Behold eksisterende database og data; rollback skal ikke gjenopprette gammel database over nye brukerdata.

## 8. Hva denne leveransen gjør ferdig

Oppdateringen er ferdig når alle avtalte akseptansekriterier er kontrollert, ytelsesresultater er dokumentert, produksjon viser riktig versjon og brukeren kan gå fra I dag til øktanalyse, Helse og Din form uten tomme eller misvisende tilstander.

Resultatet skal være en roligere og mer nyttig app med det godkjente designet: mindre forklaringsstøy, mer presis analyse og raskere tilgang til egne data. Validerte løpsprognoser, personlig responslæring og utvidet automatikk ligger fortsatt i den videre Coach Intelligence-leveransen.

**Anbefaling:** Lås dette som neste samlede implementeringspakke, og deploy etter at kriteriene over er oppfylt.
