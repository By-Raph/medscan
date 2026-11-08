/*
 * Regelmotor (PoC v0): volledig regelgebaseerd, geen AI.
 * Input: lijst items (met stoffen + ATC), sessiecontext (leeftijd, eGFR, kalium) en het regelbestand.
 * Output: lijst waarschuwingen { regelId, naam, ernst, tekst, advies, bron, itemIds }.
 * Dezelfde input geeft altijd dezelfde output.
 */
(function (root) {
  "use strict";

  var ERNST_ORDE = { hoog: 0, matig: 1, info: 2 };

  function matcht(atc, prefixen) {
    if (!atc) return false;
    for (var i = 0; i < prefixen.length; i++) if (atc.indexOf(prefixen[i]) === 0) return true;
    return false;
  }

  function telt(item) { return item.inname !== "nee"; }

  // Unieke stoffen (op ATC-code) uit actieve items die matchen met de prefixen.
  function vindStoffen(items, prefixen) {
    var perAtc = {};
    items.forEach(function (item) {
      if (!telt(item)) return;
      (item.product.stoffen || []).forEach(function (s) {
        if (!matcht(s.atc, prefixen)) return;
        if (!perAtc[s.atc]) perAtc[s.atc] = { atc: s.atc, naam: s.naam, itemIds: [] };
        if (perAtc[s.atc].itemIds.indexOf(item.id) === -1) perAtc[s.atc].itemIds.push(item.id);
      });
    });
    return Object.keys(perAtc).sort().map(function (k) { return perAtc[k]; });
  }

  function itemIdsVan(stoffen) {
    var ids = [];
    stoffen.forEach(function (s) { s.itemIds.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); }); });
    return ids;
  }

  function namen(stoffen) { return stoffen.map(function (s) { return s.naam; }).join(", "); }

  function maak(regel, ernst, tekst, itemIds) {
    return { regelId: regel.id, naam: regel.naam, ernst: ernst, tekst: tekst, advies: regel.advies, bron: regel.bron, itemIds: itemIds };
  }

  // "850 mg" -> 850, "1 g" -> 1000, anders null
  function mgVan(sterkte) {
    var m = /([\d.,]+)\s*(mg|g|microg|µg)\b/i.exec(sterkte || "");
    if (!m) return null;
    var v = parseFloat(m[1].replace(",", "."));
    var e = m[2].toLowerCase();
    return e === "g" ? v * 1000 : (e === "microg" || e === "µg") ? v / 1000 : v;
  }
  // dosisBasis "zout": sterkte van het zout (bv. metformine-HCl), zoals in de dosisrichtlijnen
  function sterkteVoor(stof, basis) { return basis === "zout" ? (stof.sterkteZout || stof.sterkte) : stof.sterkte; }
  function dagdosisMg(item, stof, basis) {
    if (item.zoNodig || item.nietDagelijks) return null;
    var mg = mgVan(sterkteVoor(stof, basis)), sch = item.schema || {};
    var n = (sch.o || 0) + (sch.m || 0) + (sch.a || 0) + (sch.s || 0);
    return mg == null || !n ? null : mg * n;
  }
  // Eén voorwaarde: alle opgegeven criteria moeten kloppen
  function voldoet(v, ctx, item, stof, basis) {
    if (v.egfrOnder != null && !(ctx.egfr != null && ctx.egfr < v.egfrOnder)) return false;
    if (v.leeftijdVanaf != null && !(ctx.leeftijd != null && ctx.leeftijd >= v.leeftijdVanaf)) return false;
    if (v.sterkteVanafMg != null) { var mg = mgVan(sterkteVoor(stof, basis)); if (mg == null || mg < v.sterkteVanafMg) return false; }
    if (v.dagdosisBovenMg != null) { var dd = dagdosisMg(item, stof, basis); if (dd == null || dd <= v.dagdosisBovenMg) return false; }
    return true;
  }
  function vulIn(t, ctx, item, stof, basis) {
    return (t || "").replace(/\{egfr\}/g, ctx.egfr).replace(/\{leeftijd\}/g, ctx.leeftijd)
      .replace(/\{stof\}/g, stof.naam).replace(/\{product\}/g, item.product.naam)
      .replace(/\{dagdosis\}/g, Math.round(dagdosisMg(item, stof, basis) * 10) / 10);
  }

  var handlers = {
    // Eén middel + context (eGFR, leeftijd, sterkte, dagdosis). Eerste voorwaarde die klopt, telt.
    context: function (regel, items, ctx) {
      var uit = [];
      items.forEach(function (item) {
        if (!telt(item)) return;
        var stof = (item.product.stoffen || []).find(function (s) { return matcht(s.atc, regel.atc); });
        if (!stof) return;
        for (var i = 0; i < regel.voorwaarden.length; i++) {
          var v = regel.voorwaarden[i];
          if (!voldoet(v, ctx, item, stof, regel.dosisBasis)) continue;
          var w = maak(regel, v.ernst, vulIn(v.tekst, ctx, item, stof, regel.dosisBasis), [item.id]);
          w.advies = vulIn(v.advies || regel.advies, ctx, item, stof, regel.dosisBasis);
          uit.push(w);
          break;
        }
      });
      return uit;
    },

    telling: function (regel, items, ctx) {
      var stoffen = vindStoffen(items, regel.atc);
      if (stoffen.length < regel.drempel) return [];
      var ernst = regel.ernst, v = regel.verhoogNaarHoog || {}, redenen = [];
      if (v.aantalVanaf && stoffen.length >= v.aantalVanaf) redenen.push(stoffen.length + " middelen");
      if (v.egfrOnder && ctx.egfr != null && ctx.egfr < v.egfrOnder) redenen.push("eGFR " + ctx.egfr);
      if (v.kaliumBoven && ctx.kalium != null && ctx.kalium > v.kaliumBoven) redenen.push("K⁺ " + ctx.kalium);
      if (redenen.length) ernst = "hoog";
      var tekst = regel.tekst.replace("{n}", stoffen.length).replace("{stoffen}", namen(stoffen));
      if (redenen.length) tekst += " Hoge prioriteit: " + redenen.join(", ") + ".";
      return [maak(regel, ernst, tekst, itemIdsVan(stoffen))];
    },

    combinatie: function (regel, items) {
      var perGroep = regel.groepen.map(function (g) { return vindStoffen(items, g.atc); });
      if (perGroep.some(function (s) { return s.length === 0; })) return [];
      var alle = [].concat.apply([], perGroep);
      var tekst = regel.tekst.replace("{stoffen}", perGroep.map(function (s, i) {
        return regel.groepen[i].naam + " (" + namen(s) + ")";
      }).join(" + "));
      return [maak(regel, regel.ernst, tekst, itemIdsVan(alle))];
    },

    dubbel: function (regel, items) {
      var uit = [], perAtc5 = {}, perAtc4 = {};
      items.forEach(function (item) {
        if (!telt(item)) return;
        (item.product.stoffen || []).forEach(function (s) {
          if (!s.atc || s.atc.length < 7) return;
          (perAtc5[s.atc] = perAtc5[s.atc] || []).push({ item: item, stof: s });
          var k4 = s.atc.slice(0, 5);
          (perAtc4[k4] = perAtc4[k4] || []).push({ item: item, stof: s });
        });
      });
      // Zelfde stof in meerdere producten (zelfde product 2x is al samengevoegd bij het scannen).
      Object.keys(perAtc5).sort().forEach(function (atc) {
        var lijst = perAtc5[atc];
        var ids = lijst.map(function (x) { return x.item.id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (ids.length < 2) return;
        var tekst = regel.tekst.replace("{stoffen}", lijst[0].stof.naam + " in " + lijst.map(function (x) { return x.item.product.naam; }).join(" + "));
        uit.push(maak(regel, regel.ernst, tekst, ids));
      });
      // Zelfde klasse (ATC niveau 4), verschillende stof.
      Object.keys(perAtc4).sort().forEach(function (k4) {
        var lijst = perAtc4[k4];
        var verschillend = lijst.map(function (x) { return x.stof.atc; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (verschillend.length < 2) return;
        var ids = lijst.map(function (x) { return x.item.id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var stofNamen = lijst.map(function (x) { return x.stof.naam; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var tekst = regel.tekstTherapeutisch.replace("{klasse}", "ATC " + k4).replace("{stoffen}", stofNamen.join(", "));
        var w = maak(regel, regel.ernstTherapeutisch, tekst, ids);
        w.regelId = regel.id + "-klasse";
        w.naam = "Therapeutische duplicatie";
        uit.push(w);
      });
      return uit;
    },

    methotrexaat: function (regel, items) {
      var uit = [];
      items.forEach(function (item) {
        if (!telt(item)) return;
        var heeftMtx = (item.product.stoffen || []).some(function (s) { return matcht(s.atc, regel.atc); });
        if (!heeftMtx) return;
        var sch = item.schema || {};
        var dagelijks = !item.nietDagelijks && ((sch.o || 0) + (sch.m || 0) + (sch.a || 0) + (sch.s || 0)) > 0;
        if (dagelijks) uit.push(maak(regel, regel.ernst, regel.tekst, [item.id]));
      });
      return uit;
    },

    vervallen: function (regel, items) {
      var verv = items.filter(function (i) { return i.vervallen; });
      if (!verv.length) return [];
      var tekst = regel.tekst.replace("{stoffen}", verv.map(function (i) {
        return i.product.naam + (i.vervaldatum ? " (" + i.vervaldatum.split("-").reverse().join("/") + ")" : "");
      }).join(", "));
      return [maak(regel, regel.ernst, tekst, verv.map(function (i) { return i.id; }))];
    }
  };

  function evalueer(items, ctx, regelbestand) {
    ctx = ctx || {};
    var uit = [];
    regelbestand.regels.forEach(function (regel) {
      var h = handlers[regel.type];
      if (!h) return;
      uit = uit.concat(h(regel, items, ctx));
    });
    uit.sort(function (a, b) { return ERNST_ORDE[a.ernst] - ERNST_ORDE[b.ernst]; });
    return uit;
  }

  var api = { evalueer: evalueer, matcht: matcht, mgVan: mgVan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Regelmotor = api;
})(typeof window !== "undefined" ? window : this);
