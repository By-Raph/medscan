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
  versie: "v0-2026-11-08",
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
