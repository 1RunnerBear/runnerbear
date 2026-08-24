# RunnerBear 11.0.0 — Bakken Adaptive Coach Engine

## Kvalitetsøkter som faktisk coaches

- Fast veksel mellom maler er erstattet av en fase-, respons- og ukekontekststyrt Bakken-motor.
- To kvalitetsdager i samme uke får definerte roller: et kontrollert terskelanker og en kompletterende kort terskel-, X- eller løpsspesifikk stimulans.
- `5 × 1000 m VO₂` er ikke lenger standardøkt. Den ligger som en sjelden, eksplisitt X-kandidat for grønt responsbilde i spesifikk 5 km/10 km-fase.
- Samme økt gjentas normalt ikke innen 14 dager, og uker med to kvalitetsdoser skal inneholde minst ett terskelanker.

## Responsbasert justering

- Feedback etter kvalitetsøkter klassifiseres som `BUILD`, `HOLD`, `REDUCE`, `RECOVERY` eller `NORMAL`.
- Bare neste ulåste kvalitetsøkt kan justeres automatisk, med revisjonsbundet evidens-ID og eksisterende safe-auto-regler.
- En dårlig respons kan aldri øke distanse eller gjøre terskel til VO₂. Låste økter, løp og manuelle øktvalg respekteres.

## Aktiv fase og løpsmål

- Motoren velger mellom grunnfase, byggefase, løpsspesifikk fase, taper, løpsuke og overgang.
- B-løp inngår i belastningsbildet og erstatter en kvalitetsdose i løpsuken uten treningsgjeld.
- A-målet og eksisterende målvern beholdes som styrende ramme.

## Forklarbar coach

- Øktdetaljen viser fase, stimulus, responsmodus, trygghet og en konkret begrunnelse for valget.
- Quality Bank skiller tydelig mellom terskel, X-elementer og løpsspesifikke økter.
- Hver automatisk kvalitetsøkt får versjonert Bakken-metadata i den kanoniske planrevisjonen.

## Produksjonsvern

- Første v11-health-kall auditerer og realigner bare fremtidige, ulåste kvalitetsøkter.
- Historikk endres aldri. Reparasjonen er idempotent, én samlet planrevisjon og bruker eksisterende Tredict/Garmin-outbox.
- Health-gaten avviser produksjon dersom kvalitetsøktene mangler v11-metadata, inneholder generisk fallback, har dobbel `5 × 1000`-standard eller mangler terskelanker.
