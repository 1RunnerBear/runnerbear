# RunnerBear v10.27 — Planintegritet og historikk

Treningspreferanser regenererer nå den kanoniske planen atomisk fra dagens dato. En normaluke med to valgte kvalitetsdager får nøyaktig to kvalitetsøkter, ønsket langturdag respekteres når sikkerhetsreglene tillater det, og faktisk generert ukesvolum holdes mot ett kanonisk mål på 50 km, et coachområde på 50–55 km og et absolutt tak på 55 km. Kontrollerte avvik får en eksplisitt årsak.

Historiske plandager, Garmin- og Concept2-aktiviteter, feedback og lokal koblingshistorikk blir bevart. Alle planmutasjoner bruker authoritative historikk fra D1 og avviser endringer før dagens dato. Planvisningen henter full historikk ved behov, lar brukeren navigere til eldre uker og måneder, og viser planlagt, gjennomført og gjenstående volum separat.

Produksjonsløpet tar en D1-backup, gjenoppretter 365 dager med aktivitetsdata idempotent via stabile eksterne ID-er, og stopper deploy ved redusert historikktelling, duplikater eller manglende plan-/koblingsgrunnlag. Design Direction 1.0 / Concept 1 / Premium rolig og den eksisterende Tredict-transporten er uendret.
