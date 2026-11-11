# RunnerBear 2.2 — runtime 13.2.0

Helse, øktanalyse og ny proaktiv oppfølging bruker et normalisert, lesende datagrunnlag. Kalenderbaserte vinduer, separate referanser per domene, faktiske måledatoer og kildeavhengige mottakstider erstatter antatt ferskhet i det nye innsiktslaget. Historisk planpolicy og automatikk er uendret; nye innsikter har ingen planmyndighet.

Bakgrunnsløpet følger nye eller korrigerte økter og nattdata, lagrer én dagsinnsikt og oppfølging for hver relevant aktivitet, og oppdaterer dem idempotent. De to neste nettene vises som observasjoner med datadekning; de beskrives ikke som en måling av full restitusjon eller årsak. Eksisterende kroppssjekk er tilgjengelig ved relevante spørsmål. Ukentlig oversikt og tidligere dagsinnsikter er tilgjengelig i Helse; treningsoversikt og neste-natt-respons er også tilgjengelig fra øktdetaljen.

Målinger og innsikter beregnes på server i eksisterende femminuttersløp. Klienten leser lagret resultat uten FIT-analyse på oppstartens kritiske vei. Data holdes bare i minne i nettleseren. Nye nattdata trenger ikke manuell synk. Ved manglende agentgrunnlag virker eksisterende app videre.

Ny additiv migrering 0018 oppretter snapshots, oppfølgingsposter og eksplisitte lesekvitteringer. «Lest» betyr ikke «fulgt». Inputrevisjon og starttid beskytter mot sene jobber. Tidligere personlige data eller planhistorikk slettes ikke.

Rollout: RUNNERBEAR_AGENT_INSIGHTS=true, RUNNERBEAR_AGENT_BACKGROUND=true. RUNNERBEAR_AGENT_COMPARISONS=false: nye tverrøktsammenligninger er implementert i shadow, men aktiveres ikke før porten med minst 20 manuelt verifiserte virkelige økter er bestått. Tilgangskontrollen tillot ikke produksjonsuthenting til denne manuelle valideringen i denne kjøringen. Ingen omgåelse brukes. Ingen ny sync-owner, presise prognoser, selvjusterende modell, pushvarsler eller ekstern AI-datadeling.

Formuleringen bruker faktabundne norske tekstmaler. Ny språkmodell eller betalt tjeneste er ikke nødvendig for denne releasen. AI-formidling kan senere utvides innen de samme faktakontraktene.

Rollback: slå av de to agentflaggene eller rull tilbake kompatibel klient/Worker til 13.1.0. Behold den additive migreringen og databasen. Garmin-innhenting og eksisterende plan skal fortsette.
