# RunnerBear 12.2.2 — første etappe: historikk og tillit

Godkjent omfang: første etappe av produktforslaget 9. september 2026, med produksjonsdeploy. Concept 1 beholdes.

## Problem og endring

Produksjonen har aktivitetshistorikk, men UI leste den gjennom en planleser som ikke installeres når coach_loop_read er deaktivert. En ny nettleser kunne derfor vise tom historikk og «Utgått» på gjennomførte økter.

- Les serverens aktivitetsutvalg uavhengig av planleserens utrulling. Bevar rå aktivitet, fart, puls og øktdetaljer. Eksisterende matcheregler gjelder fortsatt.
- Oppgi om innkommende historikk er bekreftet, hvor den begynner/slutter og når den ble hentet. Forsinket eller avkortet historikk beviser ikke en uteblitt økt.
- Vis faktiske løpskilometer i ukesummen, inkludert ekstra løping. Foreløpig sum merkes når perioden ikke er bekreftet.
- Ukereview teller ikke hviledager som uteblitte økter. Realignment får ikke konkludere med tapt økt på uavklart historikk.
- Vis aktivitetsdata, helsedata og utgående kalenderstatus separat under Mer. Kalenderkvitteringen må tilhøre gjeldende planrevisjon og være fersk. Mottak på Garmin-klokken påstås ikke.
- Åpne praktisk løpssjekkliste under Mål også med coach-UI deaktivert. Målet, revisjonen og datoen må stemme. Full Race Focus beholder eksisterende sikkerhetskrav; denne tilgangen viser ingen skjulte økter eller målfart.
- Samle samtidige fullhistorikk-kall, og avvis sene svar som ellers kunne overskrevet nyere data.

Ingen migrasjon, nye fullmakter, endrede feature flags, treningsalgoritme for dosering eller manuell synk. Etappe B/C er ikke inkludert.

## Verifisering før deploy

408 tester bestått: hele Node-regresjonspakken, inkludert 10 nye scenarier. Disse kjører den faktiske UI-koden i isolert JS-miljø og read-modellen mot SQLite med produksjonsmigrasjonene. Testene dekker kald oppstart med deaktiverte flagg, registrert gjennomføring, bevarte måleverdier/rådata, manglende historikk, avkortet historikk, feilet synk, samtidige/sene svar og sjekklistens avgrensninger. Read-modellen endrer ingen aktivitets- eller planrader.

Canonical JavaScript: 465 255 byte, under eksisterende grense på 466 000. CSS gzip: 35 809 byte. Ubrukte presentasjonsfunksjoner er fjernet for å holde størrelsesbudsjettet. Ingen ny CSS-stabling.

## Produksjonskrav

Eksisterende GitHub Actions-løp skal sikkerhetskopiere, validere, publisere og kontrollere historikk, aktiv plan, tilgang og synkkø. Deretter kontrolleres den faktiske produksjonsappen: historikk, siste gjennomførte økt, løpssjekkliste, datakilder og utgitt versjon. Fysisk telefon og faktisk mottak på klokke er ikke testet av denne automatiserte kontrollen.

## Produksjonskontroll — fullført 9. september 2026

- Utgitt kilde: `64e52705eefb796f7d249188b4dd4d65ef7d6356`. GitHub-treet er identisk med det lokalt testede treet `29c38eccc091c574cc9bbdbd6aafb66353d3560a`.
- Cloud deploy [34369727369](https://github.com/1RunnerBear/runnerbear/actions/runs/34369727369): success, rapportert 15:23 UTC. UI-valideringen er også grønn.
- 364 aktiviteter før/etter, ingen duplikate eksterne ID-er. Alle 364 vises i produksjonens historikkliste.
- Økten 8. september vises som gjennomført. Ukeoversikten viser 13 km gjennomført og 1 av 2 kvalitetsøkter; aktivitetsdetaljen viser den opprinnelige registreringen på 13,1 km.
- Løpsforberedelser åpnes fra Mål. Fem praktiske punkter vises i eksisterende Concept 1-dialog. Dialogen lukker korrekt. Ingen konkurransefart eller skjulte treningsøkter vises i praktisk modus.
- Mer viser fersk aktivitets-/helsesynk, siste aktivitetsdato og separat Tredict-kvittering. Versjon 12.2.2 vises i appen.
- Offentlig read-only health-kontroll: historyIntegrity=true, samme aktive planrevisjon som før, én aktiv plan, kalender bekreftet og alle fire synkkøtall lik 0.
- Feature flags er uendret: shadow=1; read/ui/write/sync/safe_auto/goal_confidence=0. Produksjonsløpets tilgangskontroll er grønn.

Kontrollen er utført i faktisk produksjon med nettleser og driftsendepunkt. Ingen fysisk telefon eller Garmin-klokke er brukt i verifiseringen.
