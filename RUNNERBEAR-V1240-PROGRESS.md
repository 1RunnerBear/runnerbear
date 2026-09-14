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
- Produksjonsnettleseren krever ny Cloudflare Access-innlogging. Visuell kontroll av innlogget v12.4.0 er foreløpig ikke utført. Ingen fabrikkerte korrigeringer eller helsesvar sendes til produksjon.
- Fysisk mobil, skjermleser og klokkekvittering er ikke verifisert i dette miljøet.

## Produksjonskontroll

Fylles med faktisk deploy-resultat etter publisering.
