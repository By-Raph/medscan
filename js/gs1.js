/*
 * GS1-parser voor barcodes op geneesmiddelverpakkingen.
 * Leest GS1 DataMatrix (FMD) en gewone EAN-13/EAN-8.
 *
 * Ondersteunt twee invoervormen:
 *  - HRI: "(01)05412345678908(17)270531(10)LOT1(21)SN1"   (zxing textMode "HRI")
 *  - ruw: "01054123456789081727053110LOT1<GS>21SN1"       (FNC1 = GS, \x1D)
 *
 * Resultaat: { type, code, gtin, vervaldatum (YYYY-MM-DD), lot, serienummer, velden }
 */
(function (root) {
  "use strict";

  // AI's met vaste lengte (zonder de AI zelf). Alles wat niet in deze lijst
  // staat, is variabel en eindigt op GS of het einde van de string.
  var VAST = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6 };
  var GS = "\u001d";

  function gtinGeldig(cijfers) {
    if (!/^\d{8}$|^\d{12,14}$/.test(cijfers)) return false;
    var d = cijfers.split("").map(Number);
    var controle = d.pop();
    var som = 0;
    for (var i = 0; i < d.length; i++) {
      som += d[d.length - 1 - i] * (i % 2 === 0 ? 3 : 1);
    }
    return (10 - (som % 10)) % 10 === controle;
  }

  // GTIN normaliseren naar 14 cijfers (EAN-13 krijgt een 0 vooraan).
  function naarGtin14(cijfers) {
    while (cijfers.length < 14) cijfers = "0" + cijfers;
    return cijfers;
  }

  // YYMMDD -> YYYY-MM-DD. DD = 00 betekent "laatste dag van de maand".
  function datumUitYYMMDD(s) {
    if (!/^\d{6}$/.test(s)) return null;
    var jj = parseInt(s.slice(0, 2), 10), mm = parseInt(s.slice(2, 4), 10), dd = parseInt(s.slice(4, 6), 10);
    if (mm < 1 || mm > 12) return null;
    // GS1-regel: eeuw kiezen zodat de datum binnen -49/+50 jaar van nu valt; voor medicatie volstaat 20xx.
    var jaar = 2000 + jj;
    if (dd === 0) dd = new Date(jaar, mm, 0).getDate();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return jaar + "-" + p(mm) + "-" + p(dd);
  }

  function parseHRI(tekst) {
    var velden = {};
    var re = /\((\d{2,4})\)([^(]*)/g, m, gevonden = false;
    while ((m = re.exec(tekst)) !== null) {
      velden[m[1]] = m[2];
      gevonden = true;
    }
    return gevonden ? velden : null;
  }

  function parseRuw(tekst) {
    var s = tekst;
    if (s.indexOf("]d2") === 0 || s.indexOf("]C1") === 0 || s.indexOf("]Q3") === 0) s = s.slice(3);
    if (s.charAt(0) === GS) s = s.slice(1);
    var velden = {}, i = 0, veiligheid = 0;
    while (i < s.length && veiligheid++ < 20) {
      var ai = s.slice(i, i + 2);
      if (!/^\d{2}$/.test(ai)) return null;
      // 3- en 4-cijferige AI's die voor medicatie relevant kunnen zijn
      if (/^(71)$/.test(ai)) ai = s.slice(i, i + 3);           // 710-714: nationale terugbetalingscodes
      i += ai.length;
      if (VAST[ai]) {
        velden[ai] = s.slice(i, i + VAST[ai]);
        i += VAST[ai];
        if (s.charAt(i) === GS) i++;
      } else {
        var einde = s.indexOf(GS, i);
        if (einde === -1) einde = s.length;
        velden[ai] = s.slice(i, einde);
        i = einde + 1;
      }
    }
    return velden["01"] ? velden : null;
  }

  function parse(tekst, formaat) {
    tekst = (tekst || "").trim();
    var res = { type: "onbekend", code: tekst, gtin: null, vervaldatum: null, lot: null, serienummer: null, velden: null };
    if (!tekst) return res;

    var velden = tekst.charAt(0) === "(" ? parseHRI(tekst) : null;
    if (!velden && (tekst.length > 16 && /^(\]d2|\]C1|\u001d)?01\d{14}/.test(tekst))) velden = parseRuw(tekst);

    if (velden && velden["01"]) {
      res.type = "gs1";
      res.velden = velden;
      res.gtin = velden["01"];
      res.code = res.gtin;
      res.vervaldatum = velden["17"] ? datumUitYYMMDD(velden["17"]) : null;
      res.lot = velden["10"] || null;
      res.serienummer = velden["21"] || null;
      res.gtinGeldig = gtinGeldig(res.gtin);
      return res;
    }

    var cijfers = tekst.replace(/\s/g, "");
    if (/^\d{8}$|^\d{12,14}$/.test(cijfers) && gtinGeldig(cijfers)) {
      res.type = "ean";
      res.gtin = naarGtin14(cijfers);
      res.code = res.gtin;
      res.gtinGeldig = true;
      return res;
    }
    // Andere barcode (bv. oude CNK-code): de ruwe tekst dient als sleutel.
    res.type = formaat ? "andere:" + formaat : "andere";
    return res;
  }

  function isVervallen(isoDatum, vandaag) {
    if (!isoDatum) return false;
    var nu = vandaag || new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    var vandaagIso = nu.getFullYear() + "-" + p(nu.getMonth() + 1) + "-" + p(nu.getDate());
    return isoDatum < vandaagIso;
  }

  var api = { parse: parse, gtinGeldig: gtinGeldig, datumUitYYMMDD: datumUitYYMMDD, isVervallen: isVervallen };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GS1 = api;
})(typeof window !== "undefined" ? window : this);
