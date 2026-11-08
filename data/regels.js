/*
 * Regelbestand voor de regelmotor (PoC v0).
 *
 * LET OP: voorstel van Claude, NIET klinisch gevalideerd.
 * Raphael valideert ATC-lijsten, drempels en bronnen (Folia/BCFI) vóór
 * de app als meer dan een technische proof of concept gebruikt wordt.
 *
 * Werking
 * - Regels werken op ATC-codes van de afzonderlijke werkzame stoffen
 *   (combinatiepreparaten zijn al opgesplitst in de databank).
 * - Een ATC "prefix" matcht elke code die ermee begint (bv. "C09" = alle RAAS-remmers).
 * - Middelen met inname "nee" tellen NIET mee; "onduidelijk" telt wel mee.
 * - Een stof telt maar één keer, ook als ze in twee producten zit
 *   (dat vangt de regel "dubbel gebruik" op).
 *
 * Regeltypes
 * - "telling":     aantal verschillende stoffen uit de lijst >= drempel
 * - "combinatie":  uit elke groep minstens één stof aanwezig
 * - "dubbel", "methotrexaat", "vervallen": vaste logica in regelmotor.js
 *
 * Ernst: "hoog" > "matig" > "info"
 */
window.MEDSCAN_REGELS = {
  versie: "v0.2-2026-11-08 (nierfunctie voorlopig)",
  regels: [
    {
      id: "hyperkaliemie",
      naam: "Risico op hyperkaliëmie",
      type: "telling",
      atc: [
        "C09",                    // ACE-remmers, sartanen, sacubitril/valsartan, aliskiren
        "C03DA",                  // MRA: spironolacton, eplerenon, finerenon
        "C03DB",                  // amiloride, triamtereen
        "J01EA01", "J01EE01",     // trimethoprim, cotrimoxazol
        "M01AA", "M01AB", "M01AC", "M01AE", "M01AG", "M01AH", // NSAID's (M01AX uitgesloten)
        "A12BA",                  // kaliumsupplementen
        "B01AB",                  // heparines
        "L04AD01", "L04AD02",     // ciclosporine, tacrolimus
        "G03AA12"                 // drospirenon
      ],
      drempel: 2,
      ernst: "matig",
      verhoogNaarHoog: { aantalVanaf: 3, egfrOnder: 45, kaliumBoven: 5.0 },
      tekst: "{n} middelen die het kalium kunnen verhogen: {stoffen}.",
      advies: "Kalium en nierfunctie opvolgen; nagaan of elke combinatie nodig is.",
      bron: "BCFI Repertorium, interacties/hyperkaliëmie (bron nog te bevestigen)"
    },
    {
      id: "triple-whammy",
      naam: "Triple whammy (acute nierschade)",
      type: "combinatie",
      groepen: [
        { naam: "RAAS-remmer", atc: ["C09"] },
        { naam: "diureticum", atc: ["C03"] },
        { naam: "NSAID", atc: ["M01AA", "M01AB", "M01AC", "M01AE", "M01AG", "M01AH"] }
      ],
      ernst: "hoog",
      tekst: "Combinatie van {stoffen}.",
      advies: "NSAID vermijden of stoppen; zeker bij dehydratie of nierfunctiestoornis.",
      bron: "Folia, triple whammy (bron nog te bevestigen)"
    },
    {
      id: "dubbel-gebruik",
      naam: "Dubbel gebruik",
      type: "dubbel",
      ernst: "hoog",            // zelfde stof (ATC niveau 5) in 2 verschillende producten
      ernstTherapeutisch: "matig", // zelfde ATC niveau 4, andere stof
      tekst: "Zelfde werkzame stof in meerdere producten: {stoffen}.",
      tekstTherapeutisch: "Twee middelen uit dezelfde klasse ({klasse}): {stoffen}.",
      advies: "Nagaan of dit bewust is (bv. merk + generiek in de kast).",
      bron: "Algemeen principe medicatiereview"
    },
    {
      id: "methotrexaat-dagelijks",
      naam: "Methotrexaat dagelijks ingegeven",
      type: "methotrexaat",
      atc: ["L04AX03", "L01BA01"],
      ernst: "hoog",
      tekst: "Methotrexaat staat in het schema als dagelijkse inname.",
      advies: "Controleren: bij RA/psoriasis is methotrexaat bijna altijd WEKELIJKS.",
      bron: "Folia, methotrexaat: medicatiefouten (bron nog te bevestigen)"
    },
    // ===================== NIERFUNCTIE EN LEEFTIJD (voorlopig, 8/11/2026) =====================
    // Type "context": één middel + eGFR/leeftijd/sterkte/dagdosis. Eerste voorwaarde die klopt, telt.
    // Bronnen: SKP's / BCFI Repertorium. ALLE drempels nog te valideren door Raphael.
    {
      id: "nier-nsaid", naam: "NSAID: nierfunctie / leeftijd", type: "context",
      atc: ["M01AA", "M01AB", "M01AC", "M01AE", "M01AG", "M01AH"],
      voorwaarden: [
        { egfrOnder: 30, ernst: "hoog", tekst: "{product} bij eGFR {egfr}: NSAID gecontra-indiceerd bij ernstige nierinsufficiëntie.", advies: "Stoppen; alternatief: paracetamol." },
        { egfrOnder: 60, ernst: "matig", tekst: "{product} bij eGFR {egfr}.", advies: "Zo kort en zo laag mogelijk; nierfunctie opvolgen; niet combineren met RAAS-remmer + diureticum." },
        { leeftijdVanaf: 65, ernst: "matig", tekst: "{product} bij een {leeftijd}-jarige (STOPP).", advies: "Risico op GI-bloeding, nierschade, hartfalen: vermijden of zo kort mogelijk, eventueel met maagbescherming." }
      ],
      bron: "SKP NSAID's; STOPP/START v3 (te valideren)"
    },
    {
      id: "nier-metformine", naam: "Metformine: nierfunctie", type: "context",
      atc: ["A10BA02"], dosisBasis: "zout", // dosis uitgedrukt als metformine-HCl
      voorwaarden: [
        { egfrOnder: 30, ernst: "hoog", tekst: "Metformine bij eGFR {egfr}: gecontra-indiceerd.", advies: "Stoppen; ander antidiabeticum overwegen." },
        { egfrOnder: 45, dagdosisBovenMg: 1000, ernst: "hoog", tekst: "Metformine {dagdosis} mg/dag bij eGFR {egfr}.", advies: "Maximaal 1000 mg/dag bij eGFR 30-44." },
        { egfrOnder: 45, ernst: "matig", tekst: "Metformine bij eGFR {egfr}.", advies: "Max. 1000 mg/dag; niet opstarten bij eGFR 30-44; nierfunctie 3-6-maandelijks." }
      ],
      bron: "SKP metformine; BCFI (te valideren)"
    },
    {
      id: "nier-rosuvastatine", naam: "Rosuvastatine: nierfunctie", type: "context",
      atc: ["C10AA07"],
      voorwaarden: [
        { egfrOnder: 30, ernst: "hoog", tekst: "Rosuvastatine bij eGFR {egfr}: gecontra-indiceerd bij ernstige nierinsufficiëntie (klaring <30).", advies: "Overschakelen, bv. atorvastatine (geen aanpassing nodig)." },
        { egfrOnder: 60, sterkteVanafMg: 40, ernst: "hoog", tekst: "Rosuvastatine 40 mg bij eGFR {egfr}.", advies: "40 mg is gecontra-indiceerd bij matige nierinsufficiëntie: dosis verlagen." }
      ],
      bron: "SKP rosuvastatine (te valideren)"
    },
    {
      id: "nier-doac", naam: "DOAC: nierfunctie", type: "context",
      atc: ["B01AE07"],
      voorwaarden: [
        { egfrOnder: 30, ernst: "hoog", tekst: "Dabigatran bij eGFR {egfr}: gecontra-indiceerd (klaring <30).", advies: "Ander anticoagulans; specialist." },
        { egfrOnder: 50, ernst: "matig", tekst: "Dabigatran bij eGFR {egfr}.", advies: "Dosis nakijken (bv. 110 mg 2x/d); nierfunctie opvolgen." }
      ],
      bron: "SKP dabigatran; BCFI (te valideren)"
    },
    {
      id: "nier-xaban", naam: "Anti-Xa-DOAC: nierfunctie", type: "context",
      atc: ["B01AF01", "B01AF02", "B01AF03"],
      voorwaarden: [
        { egfrOnder: 15, ernst: "hoog", tekst: "{stof} bij eGFR {egfr}: niet aanbevolen (klaring <15).", advies: "Ander anticoagulans; specialist." },
        { egfrOnder: 30, ernst: "matig", tekst: "{stof} bij eGFR {egfr}.", advies: "Met voorzichtigheid; dosis nakijken volgens indicatie en SKP." }
      ],
      bron: "SKP rivaroxaban/apixaban/edoxaban (te valideren)"
    },
    {
      id: "nier-kaliumsparend", naam: "Kaliumsparend middel: nierfunctie", type: "context",
      atc: ["C03DA01", "C03DA04", "C03DB", "A12BA"],
      voorwaarden: [
        { egfrOnder: 30, ernst: "hoog", tekst: "{stof} bij eGFR {egfr}: groot risico op hyperkaliëmie.", advies: "Vermijden of strikte kaliumcontrole; specialist." }
      ],
      bron: "SKP spironolacton/eplerenon (te valideren)"
    },
    {
      id: "nier-nitrofurantoine", naam: "Nitrofurantoïne: nierfunctie", type: "context",
      atc: ["J01XE01"],
      voorwaarden: [
        { egfrOnder: 45, ernst: "matig", tekst: "Nitrofurantoïne bij eGFR {egfr}.", advies: "Vermijden (minder werkzaam, meer toxiciteit); kortdurend eventueel bij 30-44 als er geen alternatief is." }
      ],
      bron: "BCFI urineweginfecties (te valideren)"
    },
    {
      id: "nier-dosisaanpassing", naam: "Dosisaanpassing bij nierinsufficiëntie", type: "context",
      atc: ["N03AX12", "N03AX16", "C01AA05", "C07AA07"],
      voorwaarden: [
        { egfrOnder: 30, ernst: "matig", tekst: "{stof} bij eGFR {egfr}.", advies: "Dosis (en interval) aanpassen volgens de SKP." },
        { egfrOnder: 60, ernst: "info", tekst: "{stof} bij eGFR {egfr}.", advies: "Dosis nakijken; renaal geklaard." }
      ],
      bron: "SKP gabapentine/pregabaline/digoxine/sotalol (te valideren)"
    },
    {
      id: "nier-sglt2", naam: "SGLT2-remmer: nierfunctie", type: "context",
      atc: ["A10BK"],
      voorwaarden: [
        { egfrOnder: 25, ernst: "info", tekst: "{stof} bij eGFR {egfr}.", advies: "Niet opstarten bij eGFR <25; al gestart: verder volgens indicatie (hartfalen/CNI)." }
      ],
      bron: "SKP dapagliflozine/empagliflozine (te valideren)"
    },
    {
      id: "vervallen",
      naam: "Vervallen medicatie",
      type: "vervallen",
      ernst: "info",
      tekst: "Vervallen: {stoffen}.",
      advies: "Laten vervangen en de oude verpakking terugbrengen naar de apotheek.",
      bron: "Vervaldatum uit de DataMatrix (veld 17)"
    }
  ]
};
