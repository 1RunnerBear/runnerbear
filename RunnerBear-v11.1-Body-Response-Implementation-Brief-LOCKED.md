# RunnerBear v11.1 — Body Response Implementation Brief · LOCKED

**Release:** 11.1.0
**Motor:** `body-response-1`
**Design:** Concept 1 / Design Direction 1.0
**Status:** Produksjonskontrakt

## Produktregel

> Bakken-prinsippene bestemmer hvordan RunnerBear ønsker å trene. HRV, søvn, puls, faktisk belastning og egenfølelse bestemmer hvor mye kroppen tåler.

Body Response er et eget domene og en egen servermotor, men ikke en egen hovedmodul i navigasjonen. Brukeren møter én coach og én anbefaling i `I dag`.

## Låste beslutninger

1. Ingen ny hovedfane for helse.
2. Ingen universell HRV-grense eller 0–100 readiness-score.
3. Personlig median og robust variasjon beregnes over inntil 28 dager; baseline markeres som under oppbygging før minst 10 sammenlignbare dager.
4. HRV og hvilepuls er ett autonomt domene. Garmin stress og Body Battery kan senere vises som kontekst, men får ikke en ekstra beslutningsstemme.
5. Ett isolert HRV-avvik kan ikke endre planen. Minst to uavhengige domener eller et vedvarende avvik kreves for dosereduksjon.
6. Et godt responsbilde kan aldri øke planlagt dose.
7. Safe-auto kan bare redusere dagens dose med inntil 20 prosent og må bestå eksisterende Coach Loop-policy.
8. Sykdom og smerte krever eksplisitt avklaring. Ingen medisinsk diagnose eller behandlingsråd gis.
9. Snapshot, coachbeslutning og plan må ha samme `planRevisionId`; eldre helsegrunnlag vises aldri som gjeldende.
10. Historikk og eksisterende helsedata bevares. Migrering er additiv og kan kjøres idempotent.

## Beslutningsdomener

| Domene | Primærdata | Stemme | Sikring |
|---|---|---:|---|
| Autonomt | HRV + hvilepuls | Maks 1 | Kan ikke dobbelttelles |
| Søvn | Varighet mot personlig normal | Maks 1 | Individuell trend, ikke universell fasit |
| Faktisk belastning | Siste økt mot planlagt dose | Maks 1 | Alternativ trening gir ikke falske løpskilometer |
| Egenfølelse | Frisk / litt redusert / klart redusert | Maks 1 | Utløses bare når svaret er relevant |
| Sikkerhet | Sykdom / smerte | Overstyrer | Alltid eksplisitt avklaring |

## Tilstander

| Tilstand | Brukerbudskap | Planvirkning |
|---|---|---|
| `as_planned` | Planen støttes | Ingen økning; planlagt dose er taket |
| `watch` | Følg med – planen står | Ekstra margin, ingen bonusarbeid |
| `adjust` | Dosen bør ned | Maks 20 prosent på dagens ulåste økt |
| `recover` | Kroppen trenger avklaring | Eksplisitt valg før belastning |
| `wait_for_data` | Venter på ferske data | Ikke vis grønt lys |

## Akseptansekriterier

- Motor-, D1-, API-, idempotens-, revisjons-, sikkerhets-, UX- og regresjonstester er grønne.
- Canonical frontend beholder fire ressursforespørsler og avtalt ytelsesbudsjett.
- Mobil og desktop har samme beslutningshierarki, tastaturfokus, modal semantikk og redusert bevegelse.
- Produksjonsdeploy tar D1-backup, verifiserer historikk, kjører migrering før Worker-kode, validerer `/health`, app shell, Access og synk-outbox.
- Ingen merge gjennomføres før alle GitHub-sjekker er grønne. Produksjon må etterpå rapportere build `11.1.0`, schema `3` og Body Response-audit `ok: true`.

## Faglig grunnlag

Se kildeoversettelsen i [RELEASE_NOTES_v11.1.md](RELEASE_NOTES_v11.1.md). Forskningen brukes konservativt: individuell trend og målekonsistens prioriteres, flere signaler kombineres, og resultatet kommuniseres som treningsstøtte – ikke medisinsk sannhet.
