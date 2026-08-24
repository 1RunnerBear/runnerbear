# RunnerBear 10.28.1 — tillit og flyt

- Første visning venter på den kanoniske planrevisjonen og viser ikke en eldre lokal plan først.
- Planendringer lagres som én samlet revisjon. Ved feil rulles den lokale visningen tilbake.
- Tredict-synk legges atomisk i en serverstyrt utboks sammen med planendringen, kjøres umiddelbart i bakgrunnen og prøves igjen hvert femte minutt.
- Planen viser eksplisitt synkstatus: lagret, i kø, behandles, krever kontroll eller bekreftet.
- Den eldre nettleserstyrte synkbanen er sperret når kanonisk synk er aktiv.
- Øktbanken erstatter øktdetaljene som ett ark og går tilbake til detaljene når den lukkes.
- Utdaterte løpeinstruksjoner fjernes fra fremtidige hvile- og alternativdager uten å endre historikk.
- 10.28.1 gjør «Alternativ eller hvile» autoritativ selv når eldre data feilaktig fortsatt er merket som løpe-/kvalitetsøkt, og sender en trygg kansellering til Tredict.
