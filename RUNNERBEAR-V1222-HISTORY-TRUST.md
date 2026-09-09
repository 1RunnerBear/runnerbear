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
