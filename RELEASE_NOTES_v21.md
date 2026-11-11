# RunnerBear 2.1 — runtime 13.1.0

Helsevisningen skiller mellom perioder og endepunkter i cache, gjenbruker ferske data i 60 sekunder, slår sammen samtidige identiske kall og avbryter erstattede kall. En 12 sekunders tidsgrense gir lokal retry. Gyldig innhold beholdes ved oppfriskning. Periode, valgt måling, åpne detaljer og fokus bevares ved oppdatering.

Datadekning er samlet i tilgjengelige detaljer; grafen kommer tidligere. Helseverdier merkes som medianer, og siste måledato utledes fra faktiske målepunkter. Ramptest og uavklart rundestruktur omtales ikke som sikre intervaller. Din form viser én forklaring om prognosegrunnlaget. Uferdig ukereview tar ikke støtteplassen på I dag.

Aktiv helseruting bruker en felles handler, med regresjon gjennom konfigurert Worker-entrypoint og lokal D1 i workerd. Historiske rutere er bevart. Ingen databaseendring, endring av datakildeansvar, FTP, soner eller automatikk.

Validering: nye tester for endpoint-isolasjon, samtidighet, svarrekkefølge, timeout, fokus og bevaring av detaljer. Nettlesertest sammenligner 20 gjentatte helseåpninger mot forrige release med identisk 100 ms API-forsinkelse. Dette er en kontrollert fixturemåling, ikke reell mobilnett- eller produksjonslatens. Måleresultater og CI-status registreres etter kjøring.

Rollback: Worker og klientartefakter tilbake til kompatibel forrige release 13.0.0; databasen beholdes. Garmin-observasjon, 20 verifiserte økter og prediksjonsvalidering er fortsatt separate krav for senere intelligensfunksjoner.
