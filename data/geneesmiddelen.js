/*
 * Startdatabank geneesmiddelen voor de proof of concept (PoC).
 *
 * LET OP: tijdelijke, handmatig samengestelde lijst, NIET gevalideerd.
 * Wordt vervangen door de SAM v2-export (FAGG/RIZIV/BCFI) zodra die beschikbaar is.
 * - STOFFEN: werkzame stof -> ATC-code (niveau 5)
 * - MERKEN: merknaam -> lijst van werkzame stoffen (combinatiepreparaten opgesplitst).
 *   Merknamen zijn indicatief (Belgische markt), enkel bedoeld als zoekhulp.
 */
window.MEDSCAN_DB = {
  versie: "poc-seed-2026-11-08",
  STOFFEN: {
    // --- RAAS: ACE-remmers, sartanen, overige ---
    "captopril": "C09AA01", "enalapril": "C09AA02", "lisinopril": "C09AA03",
    "perindopril": "C09AA04", "ramipril": "C09AA05", "quinapril": "C09AA06",
    "benazepril": "C09AA07", "fosinopril": "C09AA09", "zofenopril": "C09AA15",
    "losartan": "C09CA01", "valsartan": "C09CA03", "irbesartan": "C09CA04",
    "candesartan": "C09CA06", "telmisartan": "C09CA07", "olmesartan": "C09CA08",
    "sacubitril/valsartan": "C09DX04", "aliskiren": "C09XA02",
    // --- Diuretica ---
    "hydrochloorthiazide": "C03AA03", "chloortalidon": "C03BA04", "indapamide": "C03BA11",
    "furosemide": "C03CA01", "bumetanide": "C03CA02", "torasemide": "C03CA04",
    "spironolacton": "C03DA01", "eplerenon": "C03DA04", "finerenon": "C03DA05",
    "amiloride": "C03DB01", "triamtereen": "C03DB02",
    // --- Bètablokkers, calciumantagonisten, overige cardio ---
    "propranolol": "C07AA05", "sotalol": "C07AA07", "metoprolol": "C07AB02",
    "atenolol": "C07AB03", "bisoprolol": "C07AB07", "nebivolol": "C07AB12", "carvedilol": "C07AG02",
    "amlodipine": "C08CA01", "felodipine": "C08CA02", "nifedipine": "C08CA05", "lercanidipine": "C08CA13",
    "verapamil": "C08DA01", "diltiazem": "C08DB01",
    "digoxine": "C01AA05", "flecaïnide": "C01BC04", "amiodaron": "C01BD01", "ivabradine": "C01EB17",
    "isosorbidemononitraat": "C01DA14", "nitroglycerine": "C01DA02", "molsidomine": "C01DX12",
    // --- Lipiden ---
    "simvastatine": "C10AA01", "pravastatine": "C10AA03", "atorvastatine": "C10AA05",
    "rosuvastatine": "C10AA07", "ezetimibe": "C10AX09",
    // --- Antitrombotica ---
    "warfarine": "B01AA03", "fenprocoumon": "B01AA04", "acenocoumarol": "B01AA07",
    "enoxaparine": "B01AB05", "nadroparine": "B01AB06", "tinzaparine": "B01AB10",
    "clopidogrel": "B01AC04", "acetylsalicylzuur (antitrombotisch)": "B01AC06",
    "prasugrel": "B01AC22", "ticagrelor": "B01AC24",
    "dabigatran": "B01AE07", "rivaroxaban": "B01AF01", "apixaban": "B01AF02", "edoxaban": "B01AF03",
    // --- NSAID's en analgetica ---
    "indometacine": "M01AB01", "diclofenac": "M01AB05", "piroxicam": "M01AC01", "meloxicam": "M01AC06",
    "ibuprofen": "M01AE01", "naproxen": "M01AE02", "ketoprofen": "M01AE03",
    "celecoxib": "M01AH01", "etoricoxib": "M01AH05",
    "paracetamol": "N02BE01", "acetylsalicylzuur (analgetisch)": "N02BA01",
    "morfine": "N02AA01", "hydromorfon": "N02AA03", "oxycodon": "N02AA05", "fentanyl": "N02AB03",
    "buprenorfine": "N02AE01", "tramadol": "N02AX02", "tapentadol": "N02AX06",
    "codeïne": "R05DA04", "methadon": "N07BC02",
    "sumatriptan": "N02CC01", "zolmitriptan": "N02CC03", "rizatriptan": "N02CC04",
    "almotriptan": "N02CC05", "eletriptan": "N02CC06",
    // --- Antidepressiva, antipsychotica, lithium ---
    "imipramine": "N06AA02", "clomipramine": "N06AA04", "amitriptyline": "N06AA09", "nortriptyline": "N06AA10",
    "fluoxetine": "N06AB03", "citalopram": "N06AB04", "paroxetine": "N06AB05", "sertraline": "N06AB06",
    "fluvoxamine": "N06AB08", "escitalopram": "N06AB10", "moclobemide": "N06AG02",
    "trazodon": "N06AX05", "mirtazapine": "N06AX11", "bupropion": "N06AX12",
    "venlafaxine": "N06AX16", "duloxetine": "N06AX21", "vortioxetine": "N06AX26",
    "haloperidol": "N05AD01", "clozapine": "N05AH02", "olanzapine": "N05AH03", "quetiapine": "N05AH04",
    "risperidon": "N05AX08", "aripiprazol": "N05AX12", "lithium": "N05AN01",
    // --- Benzodiazepines, Z-producten, anti-epileptica ---
    "diazepam": "N05BA01", "oxazepam": "N05BA04", "lorazepam": "N05BA06", "bromazepam": "N05BA08",
    "clobazam": "N05BA09", "prazepam": "N05BA11", "alprazolam": "N05BA12",
    "flunitrazepam": "N05CD03", "lormetazepam": "N05CD06", "temazepam": "N05CD07", "loprazolam": "N05CD11",
    "zopiclon": "N05CF01", "zolpidem": "N05CF02",
    "carbamazepine": "N03AF01", "oxcarbazepine": "N03AF02", "valproïnezuur": "N03AG01",
    "lamotrigine": "N03AX09", "gabapentine": "N03AX12", "levetiracetam": "N03AX14", "pregabaline": "N03AX16",
    // --- Dementie ---
    "donepezil": "N06DA02", "rivastigmine": "N06DA03", "galantamine": "N06DA04", "memantine": "N06DX01",
    // --- Maag-darm ---
    "omeprazol": "A02BC01", "pantoprazol": "A02BC02", "lansoprazol": "A02BC03",
    "rabeprazol": "A02BC04", "esomeprazol": "A02BC05",
    "metoclopramide": "A03FA01", "domperidon": "A03FA03", "ondansetron": "A04AA01",
    "lactulose": "A06AD11", "macrogol": "A06AD15",
    // --- Diabetes ---
    "metformine": "A10BA02", "gliclazide": "A10BB09", "glimepiride": "A10BB12",
    "sitagliptine": "A10BH01", "linagliptine": "A10BH05",
    "dapagliflozine": "A10BK01", "canagliflozine": "A10BK02", "empagliflozine": "A10BK03",
    "dulaglutide": "A10BJ05", "semaglutide": "A10BJ06",
    // --- Elektrolyten, vitaminen ---
    "kaliumchloride": "A12BA01", "calciumcarbonaat": "A12AA04", "colecalciferol": "A11CC05",
    // --- Hormonen ---
    "levothyroxine": "H03AA01", "dexamethason": "H02AB02", "methylprednisolon": "H02AB04",
    "prednisolon": "H02AB06", "prednison": "H02AB07", "hydrocortison": "H02AB09",
    "desmopressine": "H01BA02", "drospirenon + ethinylestradiol": "G03AA12",
    // --- Bot, jicht, immunomodulatie ---
    "alendronaat": "M05BA04", "risedronaat": "M05BA07",
    "allopurinol": "M04AA01", "febuxostat": "M04AA03", "colchicine": "M04AC01",
    "methotrexaat": "L04AX03", "ciclosporine": "L04AD01", "tacrolimus": "L04AD02",
    "hydroxychloroquine": "P01BA02",
    // --- Anti-infectieuze middelen ---
    "doxycycline": "J01AA02", "amoxicilline": "J01CA04", "amoxicilline + clavulaanzuur": "J01CR02",
    "trimethoprim": "J01EA01", "cotrimoxazol": "J01EE01",
    "claritromycine": "J01FA09", "azitromycine": "J01FA10",
    "ciprofloxacine": "J01MA02", "levofloxacine": "J01MA12", "moxifloxacine": "J01MA14",
    "nitrofurantoïne": "J01XE01", "linezolid": "J01XX08",
    // --- Urologie ---
    "alfuzosine": "G04CA01", "tamsulosine": "G04CA02", "finasteride": "G04CB01", "dutasteride": "G04CB02",
    "oxybutynine": "G04BD04", "tolterodine": "G04BD07", "solifenacine": "G04BD08",
    "fesoterodine": "G04BD11", "mirabegron": "G04BD12",
    // --- Antihistaminica, luchtwegen ---
    "hydroxyzine": "N05BB01", "promethazine": "R06AD02", "cetirizine": "R06AE07",
    "levocetirizine": "R06AE09", "desloratadine": "R06AX27",
    "salbutamol": "R03AC02", "tiotropium": "R03BB04"
  },

  // Merknaam -> werkzame stoffen. Indicatief, enkel als zoekhulp.
  MERKEN: [
    ["Coversyl", ["perindopril"]], ["Coversyl Plus", ["perindopril", "indapamide"]],
    ["Zestril", ["lisinopril"]], ["Tritace", ["ramipril"]], ["Renitec", ["enalapril"]],
    ["Cozaar", ["losartan"]], ["Diovane", ["valsartan"]], ["Co-Diovane", ["valsartan", "hydrochloorthiazide"]],
    ["Aprovel", ["irbesartan"]], ["Co-Aprovel", ["irbesartan", "hydrochloorthiazide"]],
    ["Atacand", ["candesartan"]], ["Micardis", ["telmisartan"]], ["Belsar", ["olmesartan"]],
    ["Exforge", ["amlodipine", "valsartan"]], ["Entresto", ["sacubitril/valsartan"]],
    ["Lasix", ["furosemide"]], ["Burinex", ["bumetanide"]], ["Fludex", ["indapamide"]],
    ["Aldactone", ["spironolacton"]], ["Inspra", ["eplerenon"]], ["Kerendia", ["finerenon"]],
    ["Moduretic", ["amiloride", "hydrochloorthiazide"]], ["Dytenzide", ["triamtereen", "hydrochloorthiazide"]],
    ["Emconcor", ["bisoprolol"]], ["Selozok", ["metoprolol"]], ["Lopresor", ["metoprolol"]],
    ["Nobiten", ["nebivolol"]], ["Sotalex", ["sotalol"]], ["Kredex", ["carvedilol"]],
    ["Amlor", ["amlodipine"]], ["Zanidip", ["lercanidipine"]], ["Isoptine", ["verapamil"]], ["Tildiem", ["diltiazem"]],
    ["Lanoxin", ["digoxine"]], ["Cordarone", ["amiodaron"]], ["Tambocor", ["flecaïnide"]], ["Procoralan", ["ivabradine"]],
    ["Lipitor", ["atorvastatine"]], ["Crestor", ["rosuvastatine"]], ["Zocor", ["simvastatine"]], ["Ezetrol", ["ezetimibe"]],
    ["Sintrom", ["acenocoumarol"]], ["Marevan", ["warfarine"]], ["Marcoumar", ["fenprocoumon"]],
    ["Xarelto", ["rivaroxaban"]], ["Eliquis", ["apixaban"]], ["Lixiana", ["edoxaban"]], ["Pradaxa", ["dabigatran"]],
    ["Clexane", ["enoxaparine"]], ["Fraxiparine", ["nadroparine"]], ["Innohep", ["tinzaparine"]],
    ["Asaflow", ["acetylsalicylzuur (antitrombotisch)"]], ["Cardioaspirine", ["acetylsalicylzuur (antitrombotisch)"]],
    ["Plavix", ["clopidogrel"]], ["Brilique", ["ticagrelor"]], ["Efient", ["prasugrel"]],
    ["Brufen", ["ibuprofen"]], ["Nurofen", ["ibuprofen"]], ["Voltaren", ["diclofenac"]],
    ["Naprosyne", ["naproxen"]], ["Aleve", ["naproxen"]], ["Mobic", ["meloxicam"]],
    ["Celebrex", ["celecoxib"]], ["Arcoxia", ["etoricoxib"]],
    ["Dafalgan", ["paracetamol"]], ["Perdolan", ["paracetamol"]], ["Aspirine", ["acetylsalicylzuur (analgetisch)"]],
    ["Contramal", ["tramadol"]], ["Tradonal", ["tramadol"]], ["Durogesic", ["fentanyl"]],
    ["OxyContin", ["oxycodon"]], ["MS Contin", ["morfine"]], ["Transtec", ["buprenorfine"]],
    ["Cipramil", ["citalopram"]], ["Sipralexa", ["escitalopram"]], ["Seroxat", ["paroxetine"]],
    ["Serlain", ["sertraline"]], ["Prozac", ["fluoxetine"]], ["Efexor", ["venlafaxine"]],
    ["Cymbalta", ["duloxetine"]], ["Remergon", ["mirtazapine"]], ["Trazolan", ["trazodon"]],
    ["Redomex", ["amitriptyline"]], ["Wellbutrin", ["bupropion"]], ["Brintellix", ["vortioxetine"]],
    ["Haldol", ["haloperidol"]], ["Risperdal", ["risperidon"]], ["Seroquel", ["quetiapine"]],
    ["Zyprexa", ["olanzapine"]], ["Abilify", ["aripiprazol"]], ["Camcolit", ["lithium"]],
    ["Valium", ["diazepam"]], ["Seresta", ["oxazepam"]], ["Temesta", ["lorazepam"]], ["Xanax", ["alprazolam"]],
    ["Lexotan", ["bromazepam"]], ["Loramet", ["lormetazepam"]], ["Noctamid", ["lormetazepam"]],
    ["Stilnoct", ["zolpidem"]], ["Imovane", ["zopiclon"]],
    ["Lyrica", ["pregabaline"]], ["Neurontin", ["gabapentine"]], ["Tegretol", ["carbamazepine"]],
    ["Trileptal", ["oxcarbazepine"]], ["Depakine", ["valproïnezuur"]], ["Keppra", ["levetiracetam"]], ["Lamictal", ["lamotrigine"]],
    ["Aricept", ["donepezil"]], ["Exelon", ["rivastigmine"]], ["Reminyl", ["galantamine"]], ["Ebixa", ["memantine"]],
    ["Pantomed", ["pantoprazol"]], ["Nexiam", ["esomeprazol"]], ["Losec", ["omeprazol"]],
    ["Motilium", ["domperidon"]], ["Litican", ["metoclopramide"]], ["Primperan", ["metoclopramide"]], ["Zofran", ["ondansetron"]],
    ["Movicol", ["macrogol"]], ["Duphalac", ["lactulose"]],
    ["Glucophage", ["metformine"]], ["Uni Diamicron", ["gliclazide"]], ["Amarylle", ["glimepiride"]],
    ["Januvia", ["sitagliptine"]], ["Janumet", ["sitagliptine", "metformine"]], ["Trajenta", ["linagliptine"]],
    ["Forxiga", ["dapagliflozine"]], ["Jardiance", ["empagliflozine"]], ["Synjardy", ["empagliflozine", "metformine"]],
    ["Ozempic", ["semaglutide"]], ["Trulicity", ["dulaglutide"]],
    ["L-Thyroxine", ["levothyroxine"]], ["Euthyrox", ["levothyroxine"]],
    ["Medrol", ["methylprednisolon"]], ["Minirin", ["desmopressine"]], ["Yasmin", ["drospirenon + ethinylestradiol"]],
    ["D-Cure", ["colecalciferol"]], ["Steovit D3", ["calciumcarbonaat", "colecalciferol"]],
    ["Fosamax", ["alendronaat"]], ["Actonel", ["risedronaat"]],
    ["Zyloric", ["allopurinol"]], ["Adenuric", ["febuxostat"]],
    ["Ledertrexate", ["methotrexaat"]], ["Plaquenil", ["hydroxychloroquine"]],
    ["Bactrim", ["cotrimoxazol"]], ["Eusaprim", ["cotrimoxazol"]], ["Zitromax", ["azitromycine"]],
    ["Biclar", ["claritromycine"]], ["Clamoxyl", ["amoxicilline"]], ["Augmentin", ["amoxicilline + clavulaanzuur"]],
    ["Ciproxine", ["ciprofloxacine"]], ["Tavanic", ["levofloxacine"]], ["Furadantine", ["nitrofurantoïne"]],
    ["Omic", ["tamsulosine"]], ["Xatral", ["alfuzosine"]], ["Proscar", ["finasteride"]], ["Avodart", ["dutasteride"]],
    ["Ditropan", ["oxybutynine"]], ["Vesicare", ["solifenacine"]], ["Detrusitol", ["tolterodine"]],
    ["Toviaz", ["fesoterodine"]], ["Betmiga", ["mirabegron"]],
    ["Atarax", ["hydroxyzine"]], ["Phenergan", ["promethazine"]], ["Zyrtec", ["cetirizine"]],
    ["Xyzall", ["levocetirizine"]], ["Aerius", ["desloratadine"]],
    ["Ventolin", ["salbutamol"]], ["Spiriva", ["tiotropium"]]
  ]
};
