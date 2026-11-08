# Medscan (proof of concept)

Web-app om op huisbezoek medicatieverpakkingen te scannen (GS1 DataMatrix / EAN-13), snel een medicatieschema op te bouwen en waarschuwingen te tonen voor relevante combinaties (bv. hyperkaliëmie, triple whammy).

Masterproef huisartsopleiding (ICHO), verbeteringsproject. **Proof of concept voor eigen gebruik.**

> ⚠️ Geen medisch hulpmiddel. De regels (`data/regels.js`) zijn een voorlopig voorstel en **niet klinisch gevalideerd**. Geen patiëntgegevens ingeven: het schema blijft enkel in het browservenster; de barcodetabel en de anonieme meetlog staan lokaal op het toestel.

## Gebruik
Open de GitHub Pages-link op de iPhone in Safari → Deel → *Zet op beginscherm*.

## Structuur
| Bestand | Inhoud |
|---|---|
| `index.html`, `style.css` | schermen en opmaak |
| `js/app.js` | flow: start → scan → koppelen/zoeken → dosering → overzicht |
| `js/lezer.js` | barcodelezer: zxing-wasm (live + foto), fallback @zxing/library |
| `js/gs1.js` | GS1-parser (GTIN, vervaldatum, lot, serienummer) |
| `js/regelmotor.js` | regelgebaseerde waarschuwingen (geen AI) |
| `js/opslag.js` | barcodetabel + anonieme meetlog (localStorage) |
| `data/sam.js` | geneesmiddelendatabank afgeleid uit SAMv2 (GTIN → verpakking → werkzame stoffen + ATC) |
| `data/geneesmiddelen.js` | kleine startlijst werkzame stoffen (zoekhulp) |
| `data/regels.js` | regelbestand |
| `tests/` | `node tests/test_logic.js`, `python3 tests/test_ui.py` (Playwright) |

Externe bibliotheken via cdn.jsdelivr.net: [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (Apache-2.0), [@zxing/library](https://github.com/zxing-js/library) (MIT).

## Bron geneesmiddelengegevens
Geneesmiddelengegevens: **SAMv2, Authentieke Bron Geneesmiddelen** (beheerders: FAGG, BCFI, RIZIV, FOD Volksgezondheid, eHealth), export E.20261108_030001, verwerkt met `sam_naar_medscan.py`.
Dit hergebruik heeft **geen officieel karakter** en werd niet goedgekeurd door de beheerders van SAM.
