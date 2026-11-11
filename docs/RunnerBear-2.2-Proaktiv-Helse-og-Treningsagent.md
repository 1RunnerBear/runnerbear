# RunnerBear 2.2 – proaktiv helse- og treningsagent

**Implementeringsbrief · 11. november 2026**

**Status:** Godkjent for implementering. Release 2.2 / runtime 13.2.0. Produksjonsstatus dokumenteres etter verifisert deploy. Nye øktsammenligninger forblir avslått til kontrollen av reelle økter er bestått.

**Produktløfte:** RunnerBear oppdager det som er relevant i treningen og helsedataene dine, forklarer hvorfor det betyr noe, og følger opp om vurderingen holdt.

## 1. Anbefalt neste steg

Neste versjon skal prioritere helseforståelse og nyttig øktanalyse. Behold original A / Editorial Athlete, de fire fanene og den rolige presentasjonen. Brukeren skal merke mer sammenheng og personlig relevans, uten flere hovedfaner eller en ny designrunde.

Bygg én komplett kjede:

**Registrert økt → presis analyse → kroppens respons neste morgen → ett begrunnet råd → dokumentert oppfølging.**

En proaktiv agent innebærer her at appens backend oppdager hendelser, vurderer dem og følger dem opp selv. Brukeren skal ikke måtte åpne hver graf, starte en analyse eller be om en ukesoppsummering. Innsjekk brukes bare når den kan endre vurderingen. Dette er en funksjon i RunnerBear, ikke en separat ChatGPT-automatisering.

Planforslag er sekundære. Et godt resultat kan være «Vi ser ingen tydelig endring – fortsett som planlagt», med et konkret grunnlag.

## 2. Hva som faktisk mangler etter 2.1

Grunnlaget er den publiserte 2.1-rapporten, hovedbriefen for Coach Intelligence og en gjennomgang av gjeldende analysekode. Dette er ikke en ny full audit av alle produksjonsdata.

| Område | Dagens begrensning | Oppgaven i 2.2 |
|---|---|---|
| Samlet helseforståelse | Registrerte Garmin-data kan vises mens Body Response avventer et annet datagrunnlag | Ett normalisert evidensgrunnlag med tydelig kilde, dekning og gyldighet per domene |
| Personlig normal | Baseline og ferskhet har forenklinger som må rettes før sterkere konklusjoner | Kalenderbaserte vinduer, kildeavhengig ferskhet og sikkerhet per måling |
| Øktanalyse | Segmenter og variasjon beskrives, men forklaringen av treningsverdi er begrenset | Hensikt, faktisk stimulus, relevante sammenligninger og avgrensede funn |
| Respons etter trening | Koblingen mellom økt, neste natts målinger og egenfølelse er svak | Oppfølging etter 24/48 timer, med ærlig beskrivelse av samtidige påvirkninger |
| Proaktivitet | Eksisterende kontekstuelle coachflater gir ikke alene et komplett hendelses- og oppfølgingsløp | Vedvarende tilstand for oppdaget, vist, fulgt opp og avsluttet innsikt |
| Helseoverblikk | Grafer og verdier gir brukeren mye tolkningsarbeid | Kort helsevurdering med hva som har endret seg og hva som bør følges |
| Personlig læring | Begrenset dokumentert evaluering av tidligere råd | Responslogg og etterkontroll; personlig modellkalibrering er en senere, kontrollert funksjon |

Det finnes allerede Body Response, kontekstuell coach, ukereview, innsjekk og treningshistorikk. Disse skal videreutvikles. Ikke bygg parallelle motorer som kan gi motstridende råd.

## 3. Først: gjør helsegrunnlaget konsistent

### Konkrete kodefunn som skal håndteres

I den eksisterende Body Response-koden finnes blant annet følgende forenklinger:

- Dagsdato omgjøres til et antatt måletidspunkt klokken 06:00 UTC. Dette er ikke et faktisk sensortidspunkt.
- «7/28 dager» beregnes flere steder ved å ta et antall rader. Ved datagap er dette ikke nødvendigvis samme kalenderperiode.
- Generell synkstatus fra Garmin/Tredict kan brukes som ferskhetsgrunnlag, selv om den relevante helsemålingen kommer fra et annet løp.
- Global baselinekvalitet kan bygge på den best dekkede målingen. Det kan skjule at andre domener har lite grunnlag.
- Manglende forholdstall kan sendes videre som normalverdien 1. Dette må gjennomgås ende til ende så ukjent aldri behandles som normal respons.

Dette er kodefunn og mulige feiltolkninger, ikke påstander om at hver situasjon har oppstått i produksjon.

### Leveranse

Lag en felles lesende evidensprojeksjon for helseskjerm, innsikt og coach. Gjenbruk eksisterende kildeadaptere og regler for sammenslåing. Behold opprinnelig kilde og adskill observert måling, avledet tolkning og planbeslutning.

Hver måling skal ha måledato, faktisk måletid når tilgjengelig, tidsoppløsning, mottakstid, kilde, kvalitetsstatus og dekning. Når bare dato finnes, skal appen si det og bruke en eksplisitt datobasert gyldighetsregel; den skal ikke finne på et klokkeslett.

Bruk kalendergrenser i Europe/Oslo og test sommertid. Én dag kan ha flere oppdateringer, men telles én gang per måledefinisjon. Nattlig HRV og andre HRV-målinger skal ikke blandes ukritisk. Databrudd, kilde-/enhetsbytte og endret måledefinisjon skal kunne senke sammenlignbarheten.

Vis vurdering for domener med tilstrekkelig grunnlag selv når et annet domene mangler. Eksempel: «Søvnen er kortere enn din vanlige periode. Vi mangler nok HRV-data til å vurdere den trenden.» Unngå en permanent global «venter»-tilstand.

Personlig normal vurderes med robuste metoder og tilstrekkelig historikk, med aktuell natt adskilt fra referansen. Eksisterende terskler skal ikke bare byttes mot nye vilkårlige prosenter. Krav til antall netter, spredning, sammenhengende dekning og oppdatering fastsettes som versjonerte produktregler og valideres. RunnerBears statistiske referanse må ikke presenteres som Garmins proprietære HRV-status.

**Kildeautoritet:** En lesende innsiktsprojeksjon kan gi observerte analyser uten at ny synkroniseringseier eller automatikk aktiveres. Endret grunnlag for eksisterende planbeslutninger skal testes i shadow før overgang. Den tidligere 14-dagersporten gjelder fortsatt ved ny sync-owner; historiske måledager erstatter ikke operative observasjonsdager.

## 4. Helse: fra tall til forståelse

Helse starter med én kort vurdering: hva har endret seg mot din normal, hvilke data støtter dette, og hva bør følges opp? Deretter én hovedgraf med personlig referanse der grunnlaget holder. Behold nåværende periodevalg og tilgjengelige måle-/kildedetaljer.

Prioriter disse domenene:

1. **Restitusjon:** HRV-trend, hvilepuls og egenfølelse. Ikke konkluder fra én isolert natt.
2. **Søvn:** Varighet og regelmessighet, samt opplevd uthvilthet ved behov. Leggetid/oppvåkning og søvnregelmessighet krever faktiske tidsdata; dagsvarighet alene er ikke nok.
3. **Trening og respons:** Sammenhengen i tid mellom faktisk dose og de neste nettenes målinger.
4. **Akilles og løpstoleranse:** Egenrapportert morgenstivhet, symptomutvikling og faktisk løpsbelastning. Gamle opplysninger er historikk, ikke dagens symptomstatus.
5. **Søvn og pust:** Nattlige observasjoner og dekning, med symptomstyrt informasjon og eksisterende forsiktige språk.

En manglende måling skal begrense akkurat den tolkningen den påvirker. Ingen ny ugjennomsiktig helsescore.

Ved motstrid mellom en registrert god egenfølelse og et avvik i målingene: beskriv motstriden og spør bare når svaret har betydning. Ikke gi et automatisk dramatisk råd.

### Eksempel på ønsket tekst

> Søvnen har vært kortere enn din vanlige periode tre netter på rad. Hvilepulsen ligger samtidig høyere. Det gir grunn til å være mer forsiktig med belastningen, men sier ikke alene hva årsaken er. Hvordan kjennes kroppen i dag?

Dette er illustrasjon. Tall, trend og råd skal bare vises når faktiske data og godkjente regler støtter teksten.

## 5. Trening: hva fikk jeg ut av økten?

Alle støttede analyser skal forklare:

- Hva økten var ment å gjøre, dersom hensikten faktisk er kjent.
- Hva som ble gjennomført, adskilt fra planmatch.
- Det mest interessante funnet, med tallgrunnlag og riktig usikkerhet.
- Hva vi kan sammenligne med, og hva som gjør sammenligningen begrenset.
- Hva som eventuelt bør følges neste morgen.

| Økttype | Nyttig analyse | Begrensning |
|---|---|---|
| Løpsintervaller | Faktisk arbeidstid, tempo/puls per drag, variasjon og utvikling gjennom dragene | Puls alene beviser ikke fysiologisk terskel eller laktatnivå |
| Rolig løp/langtur | Fart og puls under sammenlignbare deler, faktisk varighet, terreng og eventuell drift | Drift krever egnet sammenhengende tidsserie; sluttpuls minus startpuls er utilstrekkelig |
| Zwift-intervaller | Arbeid og pauser separat, effekt/puls, jevnhet og sammenligning av samme øktstruktur | Ramptest og snitteffekt er ikke automatisk FTP |
| Concept2 | Split/500 m, watt, frekvens og puls når kilden har disse dataene | Ikke slå sammen roing og løp til én prestasjonstrend |
| Svømming | Lengder, registrerte arbeidsdeler og tempo/100 m | Manglende lengde-/pausestruktur gir begrenset analyse |

Bygg løp og Zwift som fullverdige vertikale leveranser først. Roing og svømming får ærlig beskrivende analyse når dypere datagrunnlag mangler; de skal ikke få generiske løpsråd.

Sammenlign økter med samme sport, tilstrekkelig lik struktur, måleutstyr og kontekst. Temperatur, vind, underlag og opplevd intensitet brukes bare når kjent. Ikke kall høyere fart ved lavere puls dokumentert fremgang hvis sammenligningen er dårlig. Et foreløpig funn skal kunne merkes som foreløpig eller holdes tilbake.

Vis maksimalt tre relevante funn i detaljen, og bare det viktigste på I dag. Gi også konkrete positive funn når de kan dokumenteres.

## 6. Den proaktive agenten

### Hendelser og oppgaver

| Hendelse | Automatisk oppgave | Brukerverdi |
|---|---|---|
| Ny eller korrigert aktivitet | Normaliser, analyser og vurder relevante sammenligninger | Ny innsikt fra faktisk trening |
| Nye nattdata | Oppdater helsedomener og eventuelle åpne oppfølginger | Dagens helsebilde bygger på siste tilgjengelige grunnlag |
| Første relevante natt etter økt | Koble målinger og eventuell innsjekk til økten | «Dette observerte vi etter økten» |
| Senere data eller ny symptomopplysning | Revider vurderingen og marker vesentlig endring | Tidligere råd blir fulgt opp og kan korrigeres |
| Ukeavslutning | Utvid eksisterende review med helse, trening og respons | Ett kort læringspunkt og én prioritet |
| Ny vedvarende trend | Kontroller kvalitet, sammenlignbarhet og nytte | Relevant oppdagelse uten at brukeren må spørre |

Tidspunkt styres av at data faktisk har kommet, ikke av at klokken passerte et fast morgentidspunkt. Når nattdata kommer sent, oppdateres samme vurdering; det opprettes ikke flere konkurrerende morgenrapporter. Vis siste gyldige vurdering med dato mens ny informasjon mangler.

Oppfølging ved 24/48 timer er et observasjonsvindu, ikke et løfte om at hele kroppens restitusjon kan beregnes på dette tidspunktet. Flere økter, sykdom, livsbelastning og ufullstendige målinger kan gjøre attribusjon usikker. Bruk «etter økten observerte vi …», ikke «økten forårsaket …» uten grunnlag.

### Prioritering og oppfølging

Én hovedinnsikt på I dag. Prioriter dokumenterte sikkerhets-/symptomforhold, deretter et nytt handlingsrelevant helsefunn, fersk øktanalyse og dokumentert positiv utvikling. Valget skal bruke relevans og nyhet; ikke alltid gi alle helsemålinger forrang foran trening.

Hver innsikt får en status: oppdaget, avventer nødvendig grunnlag, klar, vist, sett, avventer oppfølging, fulgt opp, korrigert, avsluttet eller utløpt. «Sett» betyr ikke at brukeren har fulgt rådet. Appåpning betyr ikke at innsikten er lest.

Et råd må ha neste evalueringspunkt. Når data mangler, avslutt med «ikke mulig å evaluere» etter en definert frist; ikke la gamle innsjekker henge på ubestemt tid.

### Lavt støynivå

- Maksimalt én ny ordinær hovedinnsikt per lokal dag som standard; samme innsikt kan få en datert oppdatering.
- Nye aktiviteter får alltid analyse i Trening uten å kreve nye hovedkort eller varsler.
- Dedupliser gjentatte funn og vis dem på nytt bare ved vesentlig endring.
- Still høyst ett relevant spørsmål om gangen, med enkel mulighet til å hoppe over.
- Proaktivitet leveres først inne i appen. Eksterne pushvarsler inngår bare hvis eksisterende støtte er verifisert og brukeren velger dem aktivt.
- Eventuelle varsler skal bruke nøytral tekst på låst skjerm, ikke helseverdier eller symptomer.

## 7. Personlig respons og ukentlig læring

Bygg først en etterprøvbar responslogg. For hver relevant økt: økttype og dose, etterfølgende målinger, subjektiv respons, usikkerhet og om rådet kunne evalueres. Gjenbruk eksisterende innsjekker og treningshendelser.

Første versjon kan vise observerte mønstre når tilstrekkelig sammenlignbare tilfeller finnes. Minimumsantall og krav til dekning fastsettes før lansering og testes mot risikoen for tilfeldige funn og selektiv utvelgelse. Vis antall inkluderte og ekskluderte tilfeller. Manglende svar er ikke positiv respons.

Ukesoppsummeringen skal svare på:

1. Hva ble faktisk gjort?
2. Hvordan utviklet søvn, puls, HRV og egenfølelse seg?
3. Hva lærte vi, og hvor usikkert er det?
4. Hva er ett fornuftig fokus neste uke?

Et enkelt, frivillig søvn-/rutinefokus kan følges opp over en periode. Det presenteres som et forsøk på en vane, ikke et kontrollert eksperiment eller dokumentert behandling. Ikke påstå at en HRV-endring skyldes tiltaket.

Automatisk personlig kalibrering og endring av treningsregler holdes utenfor 2.2. Innsikt og etterkontroll kan lanseres før en lærende modell er validert.

## 8. UX og designkontrakt

**I dag:** Ett nyttig funn, en kort begrunnelse og én hovedhandling. Dagens økt er lett tilgjengelig, men trenger ikke være hovedhistorien. Helsestatus skal gi relevant informasjon fremfor generell ventetekst.

**Helse:** «Slik responderer kroppen» med domenevurderinger mot personlig normal. Under: én valgt graf, respons etter siste relevante økt, akilles og søvn/pust som fordypning. Innsiktshistorikk ligger i eksisterende flate, ikke i en ny innboksfane.

**Trening:** Konklusjonen og arbeidsdata først, sammenligning og neste oppfølging under. Skillet mellom registrert, analysert og koblet til plan beholdes.

**Mål:** Dokumentert utvikling fra sammenlignbare økter. Presise konkurranseprognoser skal ikke forsinke helseløftet eller vises før egen modellvalidering.

Eksempler på tekst ved tilstrekkelig grunnlag: «Jevnere arbeidsdrag enn i de to sammenlignbare øktene», «Løpskontinuiteten er bevart, men vi mangler symptomrespons», «Vurderingen fra i går er oppdatert med nattens målinger».

Alle eksempler er illustrasjoner. Ingen nye foto, masker, ringer, scorekort eller brede chatflater er nødvendig. Behold mobil, mørk visning, 200 % tekst og tydelige fokusmarkeringer.

## 9. Teknisk implementering

Gjenbruk Workers/D1, eksisterende innhenting, Cron, Body Response og kontekstuell coach. Ett versjonert analysegrunnlag skal drive alle fire brukerflater. En eventuell kø innføres bare hvis observerte kjøretider eller retrybehov tilsier det; ikke legg til nye tjenester som standard.

### Byggepakker

| Pakke | Prioritet | Eksisterende utgangspunkt | Leveranse |
|---|---|---|---|
| A. Helsegrunnlag | P0 | `src/v11/body-response.js`, `src/v20/evidence.js`, `src/v20/health-routes.js` | Felles evidens, kalenderbaserte vinduer og domenevis gyldighet |
| B. Øktforståelse | P0 | `runnerbear-v20-intelligence.js`, FIT-innhenting og eksisterende analyser | Versjonerte øktfakta, sammenlignbarhet og relevante funn |
| C. Innsikt og oppfølging | P0 | Eksisterende Cron, treningshendelser og kontekstuell coach | Hendelsesdrevet analyse, vedvarende oppfølging og prioritering |
| D. Brukeropplevelse | P0 | Kanonisk UI-kilde, helseutvidelse og designfiler | Integrert I dag, Helse og øktdetalj mot samme vurdering |
| E. Ukentlig respons | P1, inngår | Eksisterende review- og innsjekkmodell | Ett helselæringspunkt og oppfølging av tidligere vurderinger |

Pathene er relative til repo; `src/` over viser til `cloud/runnerbear-cloud/src/`. Endelig moduldeling bestemmes etter kartlegging av gjenbruk.

### Datakontrakt

Utvid eksisterende skjema additivt der nødvendig. Kartlegg om eksisterende tabeller dekker behovet før nye opprettes. En innsikt trenger stabil ID, bruker, type, kilde-ID-er og revisjoner, evidensvindu, faktareferanser, kvalitet per domene, regel-/analyseversjon, eventuell AI-versjon, begrensninger, oppfølgingsfrist og hendelseshistorikk. Planrevisjon er nødvendig ved planforslag; en historisk øktanalyse skal ikke forsvinne bare fordi fremtidig plan endres.

Analysejobber bruker idempotent nøkkel fra bruker, hendelse, innholdsrevisjon og analyseversjon. Retry skal ikke lage nye kort, duplisere innsjekk eller telle økten flere ganger. Korrigerte kildedata invaliderer berørte analyser og oppdaterer historikken sporbart. En ferdig jobb med gammel inputrevisjon kan ikke overskrive nyere vurdering.

Innsikt beregnes i bakgrunnen. Appen leser lagret resultat med lettvektsbootstrap og separate detaljer. Ingen full FIT-/språkmodellanalyse på kritisk vei ved åpning. Relevante jobber skal ha tidsgrense, begrenset retry og synlig intern feilstatus. Ikke mist arbeid når en Worker-forespørsel avsluttes.

### AI-rollen

Deterministisk kode beregner tall, vurderer datakvalitet og velger tillatte konklusjoner. AI kan formulere dem og lage et kort, relevant oppfølgingsspørsmål. Den får et minimert faktasett, ikke hele rådatabasen eller GPS-spor. Eksisterende leverandør, tilganger og databehandling må kartlegges før en utvidelse aktiveres.

Alle tall og personlige påstander skal referere til et eksisterende faktum. Svar med nye tall, ubegrunnede årsakspåstander eller instruksjoner fra aktivitetsnavn/notater avvises. Ved feil brukes godkjente tekstmaler med samme fakta. Ingen nye AI-nøkler i nettleseren, ingen fri plan- eller soneendring og ingen gjeninnføring av Live AI Coach-chatten.

## 10. Faglige grenser og kilder

HRV vurderes mot egen historikk og trend, ikke universelle mål eller en regel om at høyere alltid er bedre. Garmin beskriver personlig baseline og omtrent tre ukers innledende måleperiode for sin HRV-status. Dette er begrunnelse for personlig kontekst, ikke validering av RunnerBears egne terskler.

Klokke-SpO₂ og nattminimum skal ikke bli pustestopp, AHI/ODI eller en diagnose. Helsenorge beskriver at snorking, observerte pustestopp og betydelig dagtretthet kan tilsi kontakt med fastlege. Symptomstyrt informasjon beholdes også når klokkedata mangler eller ser normale ut. Nye medisinske beslutningsregler krever egen faglig gjennomgang; 2.2 skal ikke markedsføres som medisinsk overvåking.

Primærkilder kontrollert 11. november 2026:

- Garmin, HRV Status: https://www.garmin.com/en-NZ/garmin-technology/health-science/hrv-status/
- Garmin, HRV-status på kompatible klokker: https://support.garmin.com/nb-NO/?faq=HnFAR4oFRF4kHeqYme3bU6&tab=topics
- Garmin, Pulse Ox FAQ: https://support.garmin.com/en-US/?faq=SK2Y9a9aBp5D6n4sXmPBG7
- Helsenorge, Søvnapné: https://www.helsenorge.no/nn/sykdom/sovnsykdommer/sovnapne/

Prosjektgrunnlag: RunnerBear 2.0 Coach Intelligence-brief, særlig den vertikale responsreisen, og 2.1-produksjonsrapporten. 2.2 konkretiserer den åpne innsikts- og responsdelen; det er ikke en påstand om at hele hovedbriefen er ferdig.

## 11. Akseptansekriterier og releaseporter

| Kontroll | Krav før aktivering |
|---|---|
| Helsegrunnlag | Datogap er ikke sammenhengende netter; manglende domene er ikke normalt; faktisk kilde og tidsoppløsning bevares |
| Kildeovergang | Sammenligning i shadow dokumenterer forskjeller før endret helsegrunnlag påvirker planbeslutninger |
| Øktanalyse | Golden fixtures for 6×6, 4×8, 3×10, 20×45/15, rolig økt, ramptest, manglende puls og målt null watt |
| Reelle økter | Den åpne porten på minst 20 manuelt verifiserte økter avklares med begrenset, autorisert tilgang til nødvendige data; ingen bred rådataeksport |
| Oppfølging | Én aktivitet → analyse → nattdata → nødvendig innsjekk → oppdatert vurdering kan gjennomføres og etterprøves ende til ende |
| Personlig innsikt | Alle personlige tall og påstander har faktareferanser; svak sammenligning gir begrenset eller ingen konklusjon |
| Hendelser | Duplikater, korrigerte kilder, sen nattdata, midnatt, sommertid, to økter samme dag og svar i feil rekkefølge håndteres |
| AI-feil | Ugyldige fakta og promptinjeksjon avvises; tekstmal fungerer ved timeout/leverandørfeil |
| Konsistens | Samme vurdering og inputrevisjon i I dag, Helse, øktdetalj og ukereview |
| UX | Én hovedhandling på mobil; ingen ny varslingsstøy; spørsmål kan hoppes over; delvis informasjon gir fortsatt nytte |
| Ytelse | Ingen ny analyse på kritisk appåpning; mål faktisk p50/p95 og overførte byte før/etter. Definer og dokumenter akseptabelt budsjett mot 2.1-baseline |
| Produksjon | Gjeldende regressjoner, faktisk Worker/D1-integrasjon, Chromium/WebKit og autentisert produksjonsreise bestått |

Driftsmål som skal instrumenteres: tid fra mottatt aktivitet til analyseklar, andel analyser med tilstrekkelig grunnlag, antall reviderte/avviste påstander, oppfølginger som faktisk kunne evalueres, og gjentatte kort per innsikt. Sett tallfestede produksjonsmål etter baseline, ikke som oppdiktede nåresultater.

Første komplette pilot er en verifiserbar Zwift-intervalløkt og en løpeøkt, begge med neste morgens respons. Avhengigheter til 14 operative dager og 20 virkelige økter skal dokumenteres med faktisk status, ikke være evige generiske ventetekster. Beskrivende innsikt kan aktiveres separat der grunnlaget er godkjent; uvaliderte sammenligninger og planpåvirkning forblir av.

## 12. Gjennomføring og avgrensning

Gjennomfør A–E som én planlagt produktrelease, med intern utvikling i vertikale deler. Rekkefølge: datakontrakt og regler → én komplett økt/responsreise → prioritering og Helse → flere økttyper og review → tester og produksjonskontroll. Ikke sett et tidsestimat før kode- og datakartleggingen er gjennomført.

Behold separat av/på-kontroll for innsiktsvisning, bakgrunnsoppfølging og eventuell AI-formulering, og gjenbruk eksisterende flaggrammeverk. Å slå av innsikt skal ikke stoppe Garmin-innhenting, skjule aktivitetshistorikk eller endre aktiv plan. Rollback beholder data og går tilbake til kompatibel 2.1-klient/Worker.

**Utenfor denne releasen:** ny hovednavigasjon, bred chat, presise konkurranseprognoser uten validering, selvjusterende treningsregler, automatisk FTP-/soneendring, medisinsk diagnostikk, ny sync-owner som omgår observasjonskrav, eller nye betalte tjenester uten dokumentert behov.

**Ferdig betyr:** Brukeren får minst én reelt nyttig og etterprøvbar økt-/helseresponsreise i appen, og kan se hva agenten oppdaget, hva vurderingen bygget på og hvordan den ble fulgt opp. En grønn deploy og nye tekstkort alene er ikke godkjent leveranse.
