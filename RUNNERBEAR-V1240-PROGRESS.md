# RunnerBear v12.4.0 — Dokumentert fremgang

Etappe C. Viderefører Concept 1 / Premium rolig.

## Leveranse

- Mål viser maksimalt to observasjoner med periode og kilde: registrert løping i de siste fire avsluttede ukene og, når grunnlaget tillater det, arbeidsfart fra to sammenlignbare kvalitetsøkter. Samme øktfamilie og fartskilde, arbeidspuls innen 3 bpm og arbeidsvarighet innen 15 prosent kreves. Ufullstendig eller utdatert aktivitetshistorikk gir ventestatus. Ingen konstruert fremgangsprosent eller målkorridor.
- Ett neste sjekkpunkt hentes fra gjeldende plan. Måltid og kapasitetsestimater fra originalgrunnlaget vises tydelig adskilt fra dokumentert utvikling.
- Gjennomført kvalitetsøkt med bekreftet arbeidsdel får «Korriger grunnlaget». Brukeren kan oppgi samme arbeidsfart for dragene eller markere arbeidsfarten som upålitelig. Omfanget er arbeidsdelen; oppvarming, pauser, nedjogg, original distanse, tid, puls og intervallmålinger bevares.
- Oppgitt fart merkes med kilde og brukes i øktvurderingen og sammenlignbart terskelgrunnlag. Den blandes ikke med målt fart i trendgrunnlaget. Upålitelig eller utdatert korrigering utelates fra fartsvurderingen. Originale kapasitetsestimater omberegnes ikke fra en oppgitt møllefart.
- Lagret korrigering kan redigeres og angres. Fem siste hendelser vises per aktivitet; hele historikken bevares. Bekreftet lagring overlever feil ved påfølgende oppfrisking. Feil gir ingen falsk lagringskvittering.

## Data og myndighet

Ny autentisert POST /api/v2/pace-corrections legger kun til activity:pace-corrected i eksisterende hendelsestabell. Ingen migrasjon. Eierskap, kilde, aktivitetsversjon, arbeidsdel, fart, tillatte felter, idempotens og forventet forrige hendelse kontrolleres. Samtidige endringer sammenlignes i samme SQLite-skrivning. Kill switch og eksisterende autentisering gjelder.

Korrigering endrer ingen plan, utrullingsflagg eller Garmin-/Tredict-data. Treningsfilosofi, doseringsregler og helseavklaringer beholdes. Automatisk planmyndighet aktiveres ikke.

## Verifikasjon før publisering

- 431 tester bestått: faktisk UI-kode i VM, autentiserte serverruter mot syntetisk SQLite/D1, sammenlignbarhet, originaldata, angre, kildetvetydighet, utdaterte korrigeringer, samtidighet, kvotefeil og klientens lagringskvitteringer. Eksisterende ressursbudsjetter bestått.
- Produksjonsbaseline 14. september 2026: 12.3.0, historyIntegrity=true, duplicateExternalIds=0, tom syncOutbox, én kanonisk plan og aktiv revisjon pr_5ac701c7-9d6d-4d28-910e-1f7367c8dc31. Kalenderspeil confirmed.
- Første deploy ble kontrollert uten innlogget nettleser. Innlogging ble senere fullført av brukeren; se visuell sluttkontroll nedenfor. Ingen fabrikkerte korrigeringer eller helsesvar er sendt til produksjon.
- Fysisk mobil, skjermleser og klokkekvittering er ikke verifisert i dette miljøet.

## Produksjonskontroll

Fullført 14. september 2026. Produksjon: https://app.runnerbear.workers.dev/

- Kildecommit d0668e68eacd3aa43fb7367cf9a594134b3d4af2. GitHub-tre 0070c4f8d712fa7145b6f508ed83168af380460a er identisk med lokalt testet tre. Bygg 12.4.0, ressursversjon 12400.
- Cloud deploy: https://github.com/1RunnerBear/runnerbear/actions/runs/34836393637 — success. UI-validering: https://github.com/1RunnerBear/runnerbear/actions/runs/34836393657 — success. Alle 431 tester bestått også i deploymiljøet.
- 370 aktiviteter før og etter deploy, duplicate_external_ids=0. Produksjonens /health bekrefter build=12.4.0, historyIntegrity=true og tom syncOutbox. Én kanonisk plan, samme aktive revisjon som baseline og kalenderspeil confirmed.
- Utrullingsflagg verifisert: shadow=1; read, ui, write, sync, safe_auto og goal_confidence=0. Privat tilgangsvern bestått.
- JavaScript 461 520 byte / gzip 132 612 byte. CSS gzip nivå 9: 35 837 byte. Alle eksisterende ressursbudsjetter beholdt.
- Ved første deploy gjensto innlogget visuell kontroll. Skjema, kildemerking, originaltotaler, angre og målvisning ble testet gjennom den faktiske UI-koden med syntetiske data og produksjonens flagg. Den påfølgende visuelle sluttkontrollen er beskrevet nedenfor.


## Visuell sluttkontroll etter innlogging

14. september 2026. Målvisningen viser 18 registrerte løpeøkter i 4 av 4 uker, periode 17. august–13. september og Garmin/Tredict som kilde. Utilstrekkelig sammenlignbart fartsgrunnlag vises som forklaring, uten konstruert trend. Ett neste planlagt sjekkpunkt: 5 × 7 min 15. september. Måltid 1:23:00 er tydelig adskilt fra observasjonene.

Plan → 8. september → Se gjennomføringen viser 6 × 6 min, arbeidsfart 4:01/km, arbeidspuls 161 bpm og original total 13,1 km. Korriger grunnlaget åpner ett skjema med to uvalgte alternativer, kilde- og omfangsforklaring. Radioetiketter og fartfelt har 48 px høyde. Ingen svar eller korrigeringer er sendt ved kontroll.

Datakilder viser automatisk oppdaterte aktiviteter og helsedata, sist hentet 14. september kl. 14:50 norsk tid. Tredict-speilet er kontrollert. Fysisk klokkekvittering holdes uttrykkelig adskilt.

Den visuelle kontrollen avdekket to feil: målets «Se økten» åpnet ukeoversikten, og lagreknappens tekst hadde for lav kontrast. Ressursversjon 12401 retter lenken til valgt dag og gir svarknappene lys tekst på mørkegrønn bakgrunn samt minst 48 px høyde. Kildecommit 55c12866d03bf0b7aa368e1cef5399028d8068ff, tre 5643ded6a0ae1d68e064e485145c7edc8b735042, identisk med lokalt testet tre. Alle 431 tester bestått. JavaScript 461 596 byte / gzip 132 620 byte; CSS gzip nivå 9: 35 852 byte.

Endelig deploy: https://github.com/1RunnerBear/runnerbear/actions/runs/34845961641 — success. UI-validering: https://github.com/1RunnerBear/runnerbear/actions/runs/34845961562 — success. 370 aktiviteter både før og etter, ingen duplikater, samme planrevisjon, tom syncOutbox og uendrede utrullingsflagg.

Etter omlasting i produksjonsnettleseren er alle tre JavaScript-ressurser bekreftet med v=12401. «Se økten 15. sep.» åpner Valgt dag / tirsdag 15. september / 5 × 7 min subterskel. Både Lagre svar og Lagre korrigering har tekst rgb(255,253,248), bakgrunn rgb(22,67,47) og høyde 48 px. Skjemaet er visuelt kontrollert, med uvalgte alternativer og original total bevart. Ingen appkonsollfeil og ingen horisontal overflyt ved 1363 px vindusbredde (1348 px innhold). Innlogget sluttkontroll er fullført; fysisk mobil, skjermleser og klokkekvittering er fortsatt ikke testet i dette miljøet.
