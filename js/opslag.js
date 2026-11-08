/*
 * Opslag van de barcodetabel (code -> product) en de anonieme meetlog.
 *
 * - Bevat GEEN patiëntgegevens: enkel welke barcode bij welk product hoort,
 *   en per sessie anonieme tellingen.
 * - In de gepubliceerde versie (claude.ai-artifact): opgeslagen in de db van het artifact,
 *   zodat de tabel bewaard blijft over toestellen heen en Claude ze kan uitlezen.
 * - Anders (lokaal testen): localStorage.
 * - Het medicatieschema zelf wordt NIET opgeslagen (enkel in het geheugen van de pagina).
 */
(function (root) {
  "use strict";

  var LS_TABEL = "medscan.gtin.v1";
  var LS_LOG = "medscan.log.v1";
  var db = null;
  var tabel = {};

  function lsLees(sleutel, standaard) {
    try { var v = localStorage.getItem(sleutel); return v ? JSON.parse(v) : standaard; } catch (e) { return standaard; }
  }
  function lsSchrijf(sleutel, waarde) {
    try { localStorage.setItem(sleutel, JSON.stringify(waarde)); } catch (e) { /* geen opslag beschikbaar */ }
  }

  // Document-id's mogen enkel letters, cijfers en _ - . ~ : @ + bevatten.
  function veiligId(code) {
    return encodeURIComponent(code).replace(/%/g, "~").replace(/[^A-Za-z0-9_\-.~:@+]/g, "_").slice(0, 190) || "leeg";
  }

  function metTimeout(belofte, ms) {
    return new Promise(function (ok, nok) {
      var t = setTimeout(function () { nok(new Error("timeout")); }, ms);
      belofte.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); nok(e); });
    });
  }

  async function init() {
    tabel = lsLees(LS_TABEL, {});
    var modus = "lokaal";
    if (root.claude && typeof root.claude.use === "function") {
      try { db = await root.claude.use("db"); } catch (e) { db = null; }
      if (db) {
        try {
          var snap = await metTimeout(db.collection("gtin").limit(1000).get(), 10000);
          snap.docs.forEach(function (d) {
            var x = d.data();
            if (x && x.code && x.product) tabel[x.code] = x.product;
          });
          lsSchrijf(LS_TABEL, tabel);
          modus = "gedeeld";
        } catch (e) {
          console.warn("[opslag] db niet bereikbaar, lokale kopie gebruikt", e);
          modus = "lokaal (db onbereikbaar)";
        }
      }
    }
    return { modus: modus, aantal: Object.keys(tabel).length };
  }

  function zoekCode(code) { return code && tabel[code] ? tabel[code] : null; }

  async function bewaarKoppeling(code, product, info) {
    tabel[code] = product;
    lsSchrijf(LS_TABEL, tabel);
    if (db) {
      try {
        await db.doc("gtin/" + veiligId(code)).set({
          code: code, product: product, type: (info && info.type) || null,
          bijgewerkt: new Date().toISOString()
        });
      } catch (e) { console.warn("[opslag] koppeling niet naar db geschreven", e); }
    }
  }

  async function vergeetKoppeling(code) {
    delete tabel[code];
    lsSchrijf(LS_TABEL, tabel);
    if (db) { try { await db.doc("gtin/" + veiligId(code)).delete(); } catch (e) { /* negeren */ } }
  }

  async function bewaarLog(log) {
    var lokaal = lsLees(LS_LOG, []);
    lokaal.push(log);
    lsSchrijf(LS_LOG, lokaal.slice(-200));
    if (db) {
      try { await db.doc("log/" + veiligId(log.id)).set(log); return true; }
      catch (e) { console.warn("[opslag] log niet naar db geschreven", e); }
    }
    return false;
  }

  function aantal() { return Object.keys(tabel).length; }
  function exporteer() { return JSON.stringify({ medscanBarcodetabel: 1, datum: new Date().toISOString().slice(0, 10), tabel: tabel }); }

  // Importeren = samenvoegen (bestaande koppelingen worden overschreven door de import).
  async function importeer(tekst) {
    var data = JSON.parse(tekst);
    var nieuw = data && data.tabel ? data.tabel : data;
    if (!nieuw || typeof nieuw !== "object") throw new Error("Geen geldige barcodetabel");
    var n = 0;
    for (var code in nieuw) {
      var p = nieuw[code];
      if (!p || typeof p.naam !== "string" || !Array.isArray(p.stoffen)) continue;
      tabel[code] = { naam: p.naam, stoffen: p.stoffen.map(function (s) { return { naam: String(s.naam), atc: s.atc ? String(s.atc) : null }; }) };
      n++;
      if (db) { try { await db.doc("gtin/" + veiligId(code)).set({ code: code, product: tabel[code], bijgewerkt: new Date().toISOString() }); } catch (e) { /* negeren */ } }
    }
    lsSchrijf(LS_TABEL, tabel);
    return n;
  }

  root.Opslag = {
    init: init, zoekCode: zoekCode, bewaarKoppeling: bewaarKoppeling, vergeetKoppeling: vergeetKoppeling,
    bewaarLog: bewaarLog, aantal: aantal, exporteer: exporteer, importeer: importeer
  };
})(window);
