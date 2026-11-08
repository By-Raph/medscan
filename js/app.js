/*
 * Medscan PoC: schermlogica.
 * Flow: start (context) -> scan -> [koppelen/zoeken] -> dosering -> ... -> overzicht -> afsluiten
 * Het schema leeft enkel in het geheugen (variabele `sessie`), nooit in opslag.
 */
(function () {
  "use strict";

  var DB = window.MEDSCAN_DB, REGELS = window.MEDSCAN_REGELS, SAM = window.MEDSCAN_SAM || null;
  var $ = function (id) { return document.getElementById(id); };
  var MOMENTEN = [["o", "Ochtend"], ["m", "Middag"], ["a", "Avond"], ["s", "Slapen"]];

  // ---------- Toestand ----------
  var sessie = null;      // { id, start, context, items[], feedback{} }
  var bewerk = null;      // item dat in het doseringsscherm open staat
  var bewerkIsNieuw = false;
  var koppelCode = null;  // gescande code die nog aan een product gekoppeld moet worden

  function nieuweSessie(context) {
    sessie = { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: Date.now(), context: context, items: [], feedback: {}, teller: 0 };
  }

  // ---------- Hulpfuncties ----------
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9/+ ]/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function getal(v) { if (v === "" || v == null) return null; var n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; }
  function fmtAantal(n) {
    if (!n) return "0";
    var heel = Math.floor(n), half = n - heel >= 0.5;
    return (heel ? heel : "") + (half ? "½" : "") || "0";
  }
  function schemaTekst(item) {
    var s = item.schema;
    var t = [s.o, s.m, s.a, s.s].map(fmtAantal).join("-");
    var extra = [];
    if (item.nietDagelijks) extra.push(item.nietDagelijks === "andere" ? (item.nietDagelijksTekst || "niet dagelijks") : item.nietDagelijks);
    if (item.zoNodig) extra.push("zo nodig");
    return t + (extra.length ? " (" + extra.join(", ") + ")" : "");
  }
  function datumNL(iso) { if (!iso) return ""; var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

  function toon(scherm) {
    ["s-start", "s-scan", "s-zoek", "s-dosering", "s-overzicht"].forEach(function (id) { $(id).hidden = id !== scherm; });
    window.scrollTo(0, 0);
  }

  var toastTimer = null;
  function toast(tekst) {
    var t = $("toast"); t.textContent = tekst; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function bezig(aan, tekst) { $("bezig").hidden = !aan; if (tekst) $("bezig-tekst").textContent = tekst; }

  // Eigen dialoog (confirm/prompt zijn geblokkeerd in een artifact)
  function dialoog(tekst, opties) {
    opties = opties || {};
    return new Promise(function (klaar) {
      $("dialoog-tekst").innerHTML = tekst;
      var inv = $("dialoog-invoer");
      inv.hidden = !opties.invoer; inv.value = opties.waarde || ""; inv.placeholder = opties.placeholder || "";
      $("dialoog-ja").textContent = opties.ja || "OK";
      $("dialoog-nee").hidden = opties.geenAnnuleer;
      $("dialoog").hidden = false;
      if (opties.invoer) setTimeout(function () { inv.focus(); }, 50);
      function sluit(ok) {
        $("dialoog").hidden = true;
        $("dialoog-ja").onclick = $("dialoog-nee").onclick = null;
        klaar(ok ? (opties.invoer ? inv.value : true) : null);
      }
      $("dialoog-ja").onclick = function () { sluit(true); };
      $("dialoog-nee").onclick = function () { sluit(false); };
    });
  }

  var laatsteModus = "";
  function statusBalk(modus) {
    if (modus) laatsteModus = modus;
    $("status").textContent = (SAM ? "SAM " + Object.keys(SAM.gtin).length + " GTIN · " : "") + Opslag.aantal() + " eigen koppelingen";
    $("tabel-info").textContent = "Eigen barcodekoppelingen: " + Opslag.aantal();
  }

  // ---------- Geneesmiddelendatabank: SAM (indien aanwezig) + startlijst stoffen ----------
  // Product uit SAM: stoffen krijgen hun eigen ATC; ontbreekt die, dan de ATC van het product.
  function samProduct(i) {
    var p = SAM.producten[i];
    return {
      naam: p[0], atc: p[1], vergund: p[3] === 1, cnk: p[4], samIndex: i, bron: "SAM",
      stoffen: p[2].map(function (x) {
        var st = SAM.stoffen[x[0]];
        return { naam: st[0], atc: st[1] || p[1] || null, sterkte: x[1] || "", sterkteZout: x[2] || "" };
      })
    };
  }
  function samZoekGtin(gtin) {
    if (!SAM || !gtin) return null;
    var i = SAM.gtin[gtin];
    return i == null ? null : samProduct(i);
  }

  var zoekIndex = (function () {
    var lijst = [];
    Object.keys(DB.STOFFEN).forEach(function (stof) {
      lijst.push({ naam: stof.charAt(0).toUpperCase() + stof.slice(1), soort: "stof", stoffen: [{ naam: stof, atc: DB.STOFFEN[stof] }], sleutel: norm(stof), vergund: true });
    });
    if (SAM) {
      SAM.producten.forEach(function (p, i) {
        lijst.push({ soort: "sam", i: i, naam: p[0], vergund: p[3] === 1, sleutel: norm(p[0]),
          stofTekst: p[2].map(function (x) { return SAM.stoffen[x[0]][0]; }).join(" + "), atc: p[1] });
      });
    } else {
      DB.MERKEN.forEach(function (m) {
        var st = m[1].map(function (s) { return { naam: s, atc: DB.STOFFEN[s] || null }; });
        lijst.push({ naam: m[0], soort: "merk", stoffen: st, sleutel: norm(m[0] + " " + m[1].join(" ")), vergund: true });
      });
    }
    return lijst;
  })();

  function zoek(term) {
    var t = norm(term);
    if (t.length < 2) return [];
    var woorden = t.split(" ");
    var res = zoekIndex.filter(function (x) {
      return woorden.every(function (w) { return x.sleutel.indexOf(w) !== -1; });
    });
    res.sort(function (a, b) {
      var sa = a.sleutel.indexOf(t) === 0 ? 0 : 1, sb = b.sleutel.indexOf(t) === 0 ? 0 : 1;
      return sa - sb || (a.vergund === b.vergund ? 0 : a.vergund ? -1 : 1) ||
        (a.soort === "stof" ? -1 : 0) - (b.soort === "stof" ? -1 : 0) || a.naam.localeCompare(b.naam);
    });
    return res.slice(0, 40);
  }

  function productUit(x) {
    if (x.soort === "sam") return samProduct(x.i);
    return { naam: x.naam, stoffen: x.stoffen };
  }

  // ---------- Barcode lezen (zie js/lezer.js) ----------
  function kiesBeste(resultaten) {
    var geparsed = resultaten.map(function (r) { return GS1.parse(r.text, r.format); });
    return geparsed.find(function (p) { return p.type === "gs1"; }) ||
           geparsed.find(function (p) { return p.type === "ean"; }) ||
           geparsed[0] || null;
  }

  function melding(tekst, soort) {
    var m = $("scan-melding"); m.innerHTML = tekst; m.className = "melding " + (soort || ""); m.hidden = !tekst;
  }

  async function verwerkFoto(bestand) {
    if (!bestand) return;
    melding("");
    bezig(true, "Barcode lezen…");
    sessie.pogingen = (sessie.pogingen || 0) + 1;
    try {
      var res = await Lezer.lees(bestand, function (t) { bezig(true, t); });
      bezig(false);
      var beste = kiesBeste(res);
      if (!beste) {
        sessie.mislukt = (sessie.mislukt || 0) + 1;
        melding("Geen barcode gevonden. Tips: hou de gsm <b>dichtbij</b> zodat de DataMatrix groot in beeld staat, scherp en zonder schittering. Of gebruik <b>Zoek op naam</b>.", "fout");
        return;
      }
      verwerkCode(beste);
    } catch (e) {
      bezig(false);
      console.error(e);
      melding("Fout bij het lezen: " + esc(e.message), "fout");
    }
  }

  // ---------- Live scanner (enkel buiten claude.ai, met wasm) ----------
  var live = { actief: false, stream: null, canvas: null, teller: 0 };
  var isLive = false;

  async function startLive() {
    $("live").hidden = false;
    $("live-tekst").textContent = "Camera starten…";
    $("live").querySelector(".live-kader").classList.remove("raak");
    try {
      live.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
    } catch (e) {
      stopLive();
      melding("Geen toegang tot de camera (" + esc(e.name || e.message) + "). Geef toestemming in de instellingen, of gebruik <b>Kies foto</b>.", "fout");
      return;
    }
    var v = $("live-video");
    v.srcObject = live.stream;
    try { await v.play(); } catch (e) { /* iOS start soms pas na metadata */ }
    $("live-tekst").textContent = "Richt op de DataMatrix of streepjescode";
    live.actief = true; live.teller = 0;
    sessie.pogingen = (sessie.pogingen || 0) + 1;
    live.canvas = live.canvas || document.createElement("canvas");
    tik();
  }

  function stopLive() {
    live.actief = false;
    if (live.stream) { live.stream.getTracks().forEach(function (t) { t.stop(); }); live.stream = null; }
    $("live-video").srcObject = null;
    $("live").hidden = true;
  }

  async function tik() {
    if (!live.actief) return;
    var v = $("live-video");
    if (v.readyState >= 2 && v.videoWidth) {
      var vw = v.videoWidth, vh = v.videoHeight;
      // Afwisselend: het midden (sneller, fijner) en af en toe het volledige beeld.
      var volledig = live.teller % 4 === 3;
      var zijde = volledig ? Math.max(vw, vh) : Math.min(vw, vh) * 0.75;
      var sx = volledig ? 0 : (vw - zijde) / 2, sy = volledig ? 0 : (vh - zijde) / 2;
      var sw = volledig ? vw : zijde, sh = volledig ? vh : zijde;
      var schaal = Math.min(1, 1100 / Math.max(sw, sh));
      var c = live.canvas; c.width = Math.round(sw * schaal); c.height = Math.round(sh * schaal);
      var ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      live.teller++;
      try {
        var res = await Lezer.leesFrame(ctx.getImageData(0, 0, c.width, c.height));
        var beste = res.length ? kiesBeste(res) : null;
        if (beste && live.actief) {
          $("live").querySelector(".live-kader").classList.add("raak");
          if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* negeren */ }
          setTimeout(function () { stopLive(); verwerkCode(beste); }, 180);
          return;
        }
      } catch (e) { console.warn("[live]", e); }
    }
    setTimeout(tik, 90);
  }

  function verwerkCode(info) {
    // Zelfde verpakking (code) al in de lijst? -> samenvoegen.
    var bestaand = sessie.items.find(function (i) { return i.code && i.code === info.code; });
    if (bestaand) {
      bestaand.aantalDoosjes = (bestaand.aantalDoosjes || 1) + 1;
      renderLijst();
      toast(bestaand.product.naam + " stond al in de lijst (" + bestaand.aantalDoosjes + " doosjes)");
      return;
    }
    // 1) eigen koppeling (ook als correctie op SAM), 2) SAM via GTIN, 3) manueel koppelen
    var product = Opslag.zoekCode(info.code), herkend = "tabel";
    if (!product) { product = samZoekGtin(info.gtin); herkend = "sam"; }
    if (product) {
      var it = nieuwItem(product, "barcode", info);
      it.herkend = herkend;
      openDosering(it, true);
    } else {
      koppelCode = info;
      openZoeken(info);
    }
  }

  function nieuwItem(product, bron, info) {
    info = info || {};
    sessie.teller++;
    return {
      id: "i" + sessie.teller, bron: bron, code: info.code || null, codeType: info.type || null,
      gtin: info.gtin || null, vervaldatum: info.vervaldatum || null, lot: info.lot || null,
      vervallen: GS1.isVervallen(info.vervaldatum),
      product: JSON.parse(JSON.stringify(product)), sterkte: product.sterkte || "",
      schema: { o: 0, m: 0, a: 0, s: 0 }, zoNodig: false, nietDagelijks: "", nietDagelijksTekst: "",
      inname: "ja", inDossier: "", aantalDoosjes: 1
    };
  }

  // ---------- Scherm: zoeken / koppelen ----------
  function openZoeken(info) {
    var ki = $("koppel-info");
    if (info) {
      $("zoek-titel").textContent = "Welk product is dit?";
      ki.hidden = false;
      ki.innerHTML = "<b>Nieuwe barcode</b>, nog niet gekend. Kies het product één keer; de app onthoudt de koppeling." +
        "<br><small>Code: " + esc(info.code) + (info.vervaldatum ? " · vervalt " + datumNL(info.vervaldatum) : "") +
        (info.lot ? " · lot " + esc(info.lot) : "") + "</small>";
    } else {
      $("zoek-titel").textContent = "Zoek op naam";
      ki.hidden = true;
    }
    $("zoek-invoer").value = "";
    renderZoek();
    toon("s-zoek");
    setTimeout(function () { $("zoek-invoer").focus(); }, 80);
  }

  function renderZoek() {
    var term = $("zoek-invoer").value;
    var res = zoek(term);
    var ul = $("zoek-resultaten");
    ul.innerHTML = "";
    res.forEach(function (x) {
      var li = document.createElement("li");
      var sub;
      if (x.soort === "sam") sub = esc(x.stofTekst) + " · " + esc(x.atc || "") + (x.vergund ? "" : " · <i>niet meer vergund</i>");
      else if (x.soort === "merk") sub = esc(x.stoffen.map(function (s) { return s.naam; }).join(" + ")) + " · " + esc(x.stoffen.map(function (s) { return s.atc; }).join(", "));
      else sub = "werkzame stof (algemeen) · " + esc(x.stoffen[0].atc);
      li.innerHTML = '<div class="naam">' + esc(x.naam) + "</div>" + '<div class="sub">' + sub + "</div>";
      li.onclick = function () { kiesProduct(productUit(x)); };
      ul.appendChild(li);
    });
    if (norm(term).length >= 2) {
      var vrij = document.createElement("li");
      vrij.className = "vrij";
      vrij.innerHTML = '<div class="naam">"' + esc(term.trim()) + '" toevoegen als vrije tekst</div><div class="sub">zonder ATC: geen controles door de regelmotor</div>';
      vrij.onclick = function () { kiesProduct({ naam: term.trim(), stoffen: [] }); };
      ul.appendChild(vrij);
    } else {
      ul.innerHTML = '<li class="leeg" style="cursor:default;border:0;background:transparent">Typ minstens 2 letters</li>';
    }
  }

  async function kiesProduct(product) {
    if (koppelCode) {
      await Opslag.bewaarKoppeling(koppelCode.code, product, koppelCode);
      statusBalk();
      var info = koppelCode; koppelCode = null;
      openDosering(nieuwItem(product, "barcode", info), true);
    } else {
      openDosering(nieuwItem(product, "manueel"), true);
    }
  }

  // ---------- Scherm: dosering ----------
  function openDosering(item, isNieuw) {
    bewerk = item; bewerkIsNieuw = isNieuw;
    $("dos-naam").textContent = item.product.naam;
    $("dos-stoffen").textContent = item.product.stoffen.length
      ? item.product.stoffen.map(function (s) { return s.naam + (s.atc ? " (" + s.atc + ")" : ""); }).join(" + ")
      : "geen ATC gekend";
    var b = [];
    if (item.bron === "barcode") b.push('<span class="badge">' + (item.herkend === "sam" ? "herkend via SAM" : "via barcode") + "</span>");
    else b.push('<span class="badge grijs">manueel</span>');
    if (item.vervaldatum) b.push('<span class="badge ' + (item.vervallen ? "rood" : "grijs") + '">' + (item.vervallen ? "VERVALLEN " : "vervalt ") + datumNL(item.vervaldatum) + "</span>");
    if (item.aantalDoosjes > 1) b.push('<span class="badge grijs">' + item.aantalDoosjes + " doosjes</span>");
    if (item.product.vergund === false) b.push('<span class="badge oranje">niet meer vergund</span>');
    if (item.code && item.bron === "barcode") b.push('<button class="badge grijs" id="btn-ontkoppel" style="border:0">fout product?</button>');
    $("dos-badges").innerHTML = b.join("");
    var ontk = $("btn-ontkoppel");
    if (ontk) ontk.onclick = async function () {
      var ok = await dialoog("Is <b>" + esc(item.product.naam) + "</b> niet het juiste product? Kies het juiste; de app onthoudt jouw keuze voor deze barcode (ook als SAM iets anders zegt).", { ja: "Kies ander product" });
      if (!ok) return;
      await Opslag.vergeetKoppeling(item.code);
      statusBalk();
      if (!bewerkIsNieuw) sessie.items = sessie.items.filter(function (i) { return i.id !== item.id; });
      koppelCode = { code: item.code, type: item.codeType, gtin: item.gtin, vervaldatum: item.vervaldatum, lot: item.lot };
      openZoeken(koppelCode);
    };
    $("dos-sterkte").value = item.sterkte || "";
    $("dos-sterkte").placeholder = item.product.bron === "SAM" ? "optioneel (sterkte staat al in de naam)" : "bv. 5 mg tablet";
    renderStappers();
    $("dos-zonodig").checked = item.zoNodig;
    $("dos-frequentie").value = item.nietDagelijks || "";
    $("dos-frequentie-tekst").value = item.nietDagelijksTekst || "";
    $("dos-frequentie-tekst").hidden = item.nietDagelijks !== "andere";
    zetSegment("dos-inname", item.inname);
    zetSegment("dos-dossier", item.inDossier);
    $("btn-dos-verwijder").hidden = isNieuw;
    $("btn-dos-opslaan").textContent = isNieuw ? "Opslaan" : "Bewaar";
    toon("s-dosering");
  }

  function renderStappers() {
    var html = MOMENTEN.map(function (m) {
      var v = bewerk.schema[m[0]];
      return '<div class="stapper"><div class="moment">' + m[1] + '</div><div class="waarde' + (v ? "" : " nul") + '">' + fmtAantal(v) +
        '</div><div class="knoppen"><button data-m="' + m[0] + '" data-d="-0.5" aria-label="minder">−</button><button data-m="' + m[0] + '" data-d="0.5" aria-label="meer">+</button></div></div>';
    }).join("");
    $("dos-schema").innerHTML = html;
    Array.prototype.forEach.call($("dos-schema").querySelectorAll("button"), function (btn) {
      btn.onclick = function () {
        var m = btn.getAttribute("data-m"), d = parseFloat(btn.getAttribute("data-d"));
        var huidig = bewerk.schema[m];
        // Eerste tik op + springt van 0 naar 1 (meest voorkomend); daarna per ½.
        var nieuw = huidig === 0 && d > 0 ? 1 : Math.max(0, Math.min(8, huidig + d));
        bewerk.schema[m] = nieuw;
        renderStappers();
      };
    });
  }

  function zetSegment(id, waarde) {
    Array.prototype.forEach.call($(id).querySelectorAll("button"), function (b) {
      b.classList.toggle("aan", b.getAttribute("data-w") === (waarde || ""));
    });
  }
  function leesSegment(id) {
    var aan = $(id).querySelector("button.aan");
    return aan ? aan.getAttribute("data-w") : "";
  }
  ["dos-inname", "dos-dossier"].forEach(function (id) {
    $(id).addEventListener("click", function (e) {
      if (e.target.tagName === "BUTTON") zetSegment(id, e.target.getAttribute("data-w"));
    });
  });

  function slaDoseringOp() {
    var it = bewerk;
    it.sterkte = $("dos-sterkte").value.trim();
    it.zoNodig = $("dos-zonodig").checked;
    it.nietDagelijks = $("dos-frequentie").value;
    it.nietDagelijksTekst = it.nietDagelijks === "andere" ? $("dos-frequentie-tekst").value.trim() : "";
    it.inname = leesSegment("dos-inname") || "ja";
    it.inDossier = leesSegment("dos-dossier");
    if (bewerkIsNieuw) sessie.items.push(it);
    bewerk = null;
    renderLijst();
    toon("s-scan");
    if (bewerkIsNieuw) toast(it.product.naam + " toegevoegd");
  }

  // ---------- Scherm: scanlijst ----------
  function renderLijst() {
    var ul = $("lijst");
    $("teller").textContent = "(" + sessie.items.length + ")";
    $("btn-afronden").disabled = sessie.items.length === 0;
    if (!sessie.items.length) { ul.innerHTML = '<li class="leeg" style="cursor:default;border:0;background:transparent">Nog niets gescand</li>'; return; }
    ul.innerHTML = "";
    sessie.items.forEach(function (it) {
      var li = document.createElement("li");
      var badges = [];
      if (it.inname === "nee") badges.push('<span class="badge rood">neemt niet</span>');
      if (it.inname === "onduidelijk") badges.push('<span class="badge oranje">onduidelijk</span>');
      if (it.vervallen) badges.push('<span class="badge rood">vervallen</span>');
      if (it.aantalDoosjes > 1) badges.push('<span class="badge grijs">' + it.aantalDoosjes + "×</span>");
      li.innerHTML = '<div class="naam">' + esc(it.product.naam) + (it.sterkte ? " " + esc(it.sterkte) : "") + "</div>" +
        '<div class="sub">' + esc(it.product.stoffen.map(function (s) { return s.naam; }).join(" + ") || "geen ATC") + "</div>" +
        '<div class="rij"><span class="schema-tekst">' + esc(schemaTekst(it)) + "</span><span>" + badges.join("") + "</span></div>";
      li.onclick = function () { openDosering(it, false); };
      ul.appendChild(li);
    });
  }

  // ---------- Scherm: overzicht ----------
  var huidigeWaarschuwingen = [];

  function openOverzicht() {
    var c = sessie.context, delen = [];
    if (c.leeftijd != null) delen.push("leeftijd " + c.leeftijd);
    if (c.egfr != null) delen.push("eGFR " + c.egfr);
    if (c.kalium != null) delen.push("K⁺ " + c.kalium);
    $("ov-context").textContent = delen.length ? "Context: " + delen.join(" · ") : "Geen context ingegeven.";

    $("ov-tabel").innerHTML = sessie.items.map(function (it) {
      return '<tr class="' + (it.inname === "nee" ? "niet-genomen" : "") + '"><td><b>' + esc(it.product.naam) + "</b>" + (it.sterkte ? " " + esc(it.sterkte) : "") +
        (it.vervallen ? ' <span class="badge rood">vervallen</span>' : "") +
        '<br><small>' + esc(it.product.stoffen.map(function (s) { return s.naam; }).join(" + ")) + "</small></td>" +
        '<td class="schema-tekst">' + esc(schemaTekst(it)) + "</td><td>" + esc(it.inname) + "</td></tr>";
    }).join("");

    huidigeWaarschuwingen = Regelmotor.evalueer(sessie.items, sessie.context, REGELS);
    $("ov-aantal").textContent = "(" + huidigeWaarschuwingen.length + ")";
    var ul = $("ov-waarschuwingen");
    ul.innerHTML = huidigeWaarschuwingen.length ? "" : '<li class="info">Geen waarschuwingen volgens de huidige regels.</li>';
    huidigeWaarschuwingen.forEach(function (w, idx) {
      var sleutel = w.regelId + ":" + w.itemIds.join(",");
      var li = document.createElement("li");
      li.className = w.ernst;
      li.innerHTML = '<div class="w-kop">' + esc(w.naam) + " · " + esc(w.ernst) + "</div><div>" + esc(w.tekst) + "</div>" +
        '<div class="w-advies">' + esc(w.advies || "") + '</div><div class="w-bron">Regel: ' + esc(w.regelId) + " · Bron: " + esc(w.bron || "") + "</div>" +
        '<div class="duimen"><button data-f="1" aria-label="nuttig">👍</button><button data-f="0" aria-label="niet nuttig">👎</button></div>';
      Array.prototype.forEach.call(li.querySelectorAll(".duimen button"), function (b) {
        if (sessie.feedback[sleutel] === b.getAttribute("data-f")) b.classList.add("aan");
        b.onclick = function () {
          sessie.feedback[sleutel] = b.getAttribute("data-f");
          Array.prototype.forEach.call(li.querySelectorAll(".duimen button"), function (x) { x.classList.toggle("aan", x === b); });
        };
      });
      ul.appendChild(li);
    });

    $("ov-tekst").value = maakTekst();
    toon("s-overzicht");
    // PDF-bibliotheken alvast laden, zodat de PDF-knop meteen werkt (iOS: delen moet snel na de tik gebeuren)
    pdfLibs().catch(function () { /* later opnieuw proberen */ });
  }

  function maakTekst() {
    var nu = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    var regels = ["Medicatieschema (opgemaakt " + p(nu.getDate()) + "/" + p(nu.getMonth() + 1) + "/" + nu.getFullYear() + ")", "Schema: ochtend-middag-avond-slapengaan", ""];
    sessie.items.forEach(function (it) {
      var r = "- " + it.product.naam + (it.sterkte ? " " + it.sterkte : "");
      var st = it.product.stoffen.map(function (s) { return s.naam; }).join(" + ");
      if (st && st.toLowerCase() !== it.product.naam.toLowerCase()) r += " (" + st + ")";
      r += ": " + schemaTekst(it);
      if (it.inname !== "ja") r += " [neemt: " + it.inname + "]";
      if (it.vervallen) r += " [VERVALLEN " + datumNL(it.vervaldatum) + "]";
      regels.push(r);
    });
    if (huidigeWaarschuwingen.length) {
      regels.push("", "Aandachtspunten:");
      huidigeWaarschuwingen.forEach(function (w) { regels.push("- [" + w.ernst + "] " + w.naam + ": " + w.tekst); });
    }
    return regels.join("\n");
  }

  // ---------- PDF (lokaal gemaakt met jsPDF, enkel geladen wanneer nodig) ----------
  var PDF_LIBS = [
    "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.9/dist/jspdf.plugin.autotable.min.js"
  ];
  function laadScript(url) {
    return new Promise(function (ok, nok) {
      var sc = document.createElement("script"); sc.src = url;
      sc.onload = ok; sc.onerror = function () { nok(new Error("Kon " + url + " niet laden (geen internet?)")); };
      document.head.appendChild(sc);
    });
  }
  async function pdfLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await laadScript(PDF_LIBS[0]);
    if (!window.autoTable && !(window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) await laadScript(PDF_LIBS[1]);
  }
  // Standaard PDF-lettertypes kennen enkel Latin-1: rest vervangen
  function pdfTekst(t) {
    return String(t == null ? "" : t).replace(/⁺/g, "+").replace(/[–—]/g, "-").replace(/[→]/g, "->")
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x00-\xff]/g, "");
  }
  function opmerking(it) {
    var o = [];
    if (it.zoNodig) o.push("zo nodig");
    if (it.nietDagelijks) o.push(it.nietDagelijks === "andere" ? (it.nietDagelijksTekst || "niet dagelijks") : it.nietDagelijks);
    if (it.inname === "nee") o.push("NEEMT NIET");
    if (it.inname === "onduidelijk") o.push("inname onduidelijk");
    if (it.vervallen) o.push("VERVALLEN " + datumNL(it.vervaldatum));
    if (it.inDossier === "nee") o.push("niet in dossier");
    return o.join(", ");
  }

  async function maakPdf() {
    bezig(true, "PDF maken…");
    try {
      await pdfLibs();
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
      var autoTable = window.autoTable || function (d, o) { return d.autoTable(o); };
      var nu = new Date(), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
      var datum = p2(nu.getDate()) + "/" + p2(nu.getMonth() + 1) + "/" + nu.getFullYear();
      var groen = [15, 61, 62];

      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(groen[0], groen[1], groen[2]);
      doc.text("Medicatieschema", 14, 18);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80);
      var c = sessie.context, ctx = [];
      if (c.leeftijd != null) ctx.push("leeftijd " + c.leeftijd);
      if (c.egfr != null) ctx.push("eGFR " + c.egfr);
      if (c.kalium != null) ctx.push("K+ " + c.kalium);
      doc.text(pdfTekst("Opgemaakt op " + datum + (ctx.length ? "   ·   Context: " + ctx.join(", ") : "")), 14, 24);
      doc.text("Patiënt: ......................................................................", 14, 30);

      var rijen = sessie.items.map(function (it) {
        var s = it.schema;
        return [
          pdfTekst(it.product.naam + (it.sterkte ? " " + it.sterkte : "") + (it.aantalDoosjes > 1 ? " (" + it.aantalDoosjes + " doosjes)" : "")),
          pdfTekst(it.product.stoffen.map(function (x) { return x.naam; }).join(" + ")),
          fmtAantal(s.o), fmtAantal(s.m), fmtAantal(s.a), fmtAantal(s.s),
          pdfTekst(opmerking(it))
        ];
      });
      autoTable(doc, {
        startY: 35,
        head: [["Geneesmiddel", "Werkzame stof(fen)", "Ochtend", "Middag", "Avond", "Slapen", "Opmerking"]],
        body: rijen,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 1.8, valign: "middle", lineColor: [210, 218, 216] },
        headStyles: { fillColor: groen, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: "bold" }, 1: { cellWidth: 36 },
          2: { cellWidth: 16.5, halign: "center", fontSize: 11 }, 3: { cellWidth: 16.5, halign: "center", fontSize: 11 },
          4: { cellWidth: 16.5, halign: "center", fontSize: 11 }, 5: { cellWidth: 16.5, halign: "center", fontSize: 11 },
          6: { cellWidth: "auto" }
        },
        didParseCell: function (d) {
          if (d.section === "body" && d.column.index >= 2 && d.column.index <= 5 && d.cell.raw === "0") d.cell.styles.textColor = [190, 198, 196];
          if (d.section === "body" && sessie.items[d.row.index] && sessie.items[d.row.index].inname === "nee") d.cell.styles.fillColor = [242, 242, 242];
        }
      });

      var y = doc.lastAutoTable.finalY + 8;
      if (huidigeWaarschuwingen.length) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(groen[0], groen[1], groen[2]);
        doc.text("Aandachtspunten", 14, y);
        autoTable(doc, {
          startY: y + 3,
          head: [["Ernst", "Aandachtspunt", "Advies"]],
          body: huidigeWaarschuwingen.map(function (w) { return [w.ernst, pdfTekst(w.naam + ": " + w.tekst), pdfTekst(w.advies || "")]; }),
          theme: "grid",
          styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [210, 218, 216] },
          headStyles: { fillColor: groen, textColor: 255 },
          columnStyles: { 0: { cellWidth: 16, fontStyle: "bold" }, 1: { cellWidth: 100 } },
          didParseCell: function (d) {
            if (d.section !== "body") return;
            var e = huidigeWaarschuwingen[d.row.index].ernst;
            d.cell.styles.fillColor = e === "hoog" ? [253, 236, 234] : e === "matig" ? [254, 243, 230] : [234, 242, 251];
          }
        });
      }

      // Voettekst op elke pagina
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120);
        var voet = "Medscan PoC (masterproef huisartsopleiding) - regels niet klinisch gevalideerd, geen medisch hulpmiddel. " +
          (SAM ? "Geneesmiddelengegevens: SAMv2 (FAGG, BCFI, RIZIV, FOD Volksgezondheid, eHealth), export " + SAM.versie + "; geen officieel karakter." : "");
        doc.text(doc.splitTextToSize(pdfTekst(voet), 182), 14, 287);
        doc.text(i + "/" + n, 196, 293, { align: "right" });
      }

      var naam = "medicatieschema-" + nu.getFullYear() + p2(nu.getMonth() + 1) + p2(nu.getDate()) + ".pdf";
      var blob = doc.output("blob");
      bezig(false);
      var bestand = null;
      try { bestand = new File([blob], naam, { type: "application/pdf" }); } catch (e) { /* oude browser */ }
      if (bestand && navigator.canShare && navigator.canShare({ files: [bestand] })) {
        try { await navigator.share({ files: [bestand], title: "Medicatieschema" }); return; }
        catch (e) { if (e && e.name === "AbortError") return; }
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      toast("PDF gemaakt");
    } catch (e) {
      bezig(false);
      console.error(e);
      await dialoog("PDF maken mislukt: " + esc(e.message), { geenAnnuleer: true });
    }
  }

  async function sluitSessieAf() {
    var ok = await dialoog("Sessie afsluiten? Het schema wordt gewist. Enkel anonieme tellingen worden bewaard voor de meting.", { ja: "Afsluiten" });
    if (!ok) return;
    var items = sessie.items;
    var log = {
      id: sessie.id,
      datum: new Date().toISOString().slice(0, 10),
      duurSec: Math.round((Date.now() - sessie.start) / 1000),
      aantalMiddelen: items.length,
      viaBarcode: items.filter(function (i) { return i.bron === "barcode"; }).length,
      herkendViaSam: items.filter(function (i) { return i.herkend === "sam"; }).length,
      herkendViaTabel: items.filter(function (i) { return i.herkend === "tabel"; }).length,
      samVersie: SAM ? SAM.versie : null,
      manueel: items.filter(function (i) { return i.bron === "manueel"; }).length,
      scanPogingen: sessie.pogingen || 0,
      scanMislukt: sessie.mislukt || 0,
      nietGenomen: items.filter(function (i) { return i.inname === "nee"; }).length,
      onduidelijk: items.filter(function (i) { return i.inname === "onduidelijk"; }).length,
      vervallen: items.filter(function (i) { return i.vervallen; }).length,
      nietInDossier: items.filter(function (i) { return i.inDossier === "nee"; }).length,
      dossierIngevuld: items.filter(function (i) { return i.inDossier; }).length,
      contextIngevuld: Object.keys(sessie.context).filter(function (k) { return sessie.context[k] != null; }),
      regelversie: REGELS.versie,
      waarschuwingen: huidigeWaarschuwingen.map(function (w) {
        var f = sessie.feedback[w.regelId + ":" + w.itemIds.join(",")];
        return { regel: w.regelId, ernst: w.ernst, nuttig: f === "1" ? true : f === "0" ? false : null };
      })
    };
    var gedeeld = await Opslag.bewaarLog(log);
    sessie = null;
    toast(gedeeld ? "Sessie afgesloten, meetlog bewaard" : "Sessie afgesloten (meetlog enkel lokaal)");
    ["ctx-leeftijd", "ctx-egfr", "ctx-kalium"].forEach(function (id) { $(id).value = ""; });
    toon("s-start");
  }

  // ---------- Gebeurtenissen ----------
  $("btn-start").onclick = function () {
    nieuweSessie({ leeftijd: getal($("ctx-leeftijd").value), egfr: getal($("ctx-egfr").value), kalium: getal($("ctx-kalium").value) });
    renderLijst(); melding(""); toon("s-scan");
  };
  ["foto-camera", "foto-galerij"].forEach(function (id) {
    $(id).addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";  // zelfde foto opnieuw kiezen moet ook werken
      verwerkFoto(f);
    });
  });
  $("btn-scan").onclick = function () { if (isLive) startLive(); else $("foto-camera").click(); };
  $("btn-live-sluit").onclick = stopLive;
  $("btn-live-foto").onclick = function () { stopLive(); $("foto-camera").click(); };
  $("btn-live-zoek").onclick = function () { stopLive(); koppelCode = null; openZoeken(null); };
  $("btn-export").onclick = async function () {
    var tekst = Opslag.exporteer();
    var gekopieerd = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(tekst); gekopieerd = true; } } catch (e) { /* manueel */ }
    await dialoog((gekopieerd ? "Barcodetabel gekopieerd naar het klembord." : "Kopieer deze tekst manueel.") +
      " Bewaar ze bv. in een notitie; met <b>Importeer</b> zet je ze terug (ook op een ander toestel).", { invoer: true, waarde: tekst, geenAnnuleer: true });
  };
  $("btn-import").onclick = async function () {
    var tekst = await dialoog("Plak hier een geëxporteerde barcodetabel:", { invoer: true, placeholder: '{"medscanBarcodetabel":1,…}', ja: "Importeer" });
    if (!tekst) return;
    try { var n = await Opslag.importeer(tekst); statusBalk(); toast(n + " koppelingen geïmporteerd"); }
    catch (e) { await dialoog("Import mislukt: " + esc(e.message), { geenAnnuleer: true }); }
  };
  $("btn-zoek").onclick = function () { koppelCode = null; openZoeken(null); };
  $("btn-code").onclick = async function () {
    var code = await dialoog("Typ of plak de code (GTIN/EAN, of GS1-tekst zoals (01)…(17)…)", { invoer: true, placeholder: "bv. 5412345678908" });
    if (code && code.trim()) verwerkCode(GS1.parse(code.trim()));
  };
  $("zoek-invoer").addEventListener("input", renderZoek);
  $("btn-zoek-terug").onclick = function () { koppelCode = null; toon("s-scan"); };
  $("dos-frequentie").onchange = function () { $("dos-frequentie-tekst").hidden = this.value !== "andere"; };
  $("btn-dos-opslaan").onclick = slaDoseringOp;
  $("btn-dos-annuleer").onclick = function () { bewerk = null; toon("s-scan"); };
  $("btn-dos-verwijder").onclick = async function () {
    var it = bewerk;
    var ok = await dialoog("<b>" + esc(it.product.naam) + "</b> uit de lijst verwijderen?", { ja: "Verwijder" });
    if (!ok) return;
    sessie.items = sessie.items.filter(function (i) { return i.id !== it.id; });
    bewerk = null; renderLijst(); toon("s-scan");
  };
  $("btn-afronden").onclick = openOverzicht;
  $("btn-ov-terug").onclick = function () { toon("s-scan"); };
  $("btn-pdf").onclick = maakPdf;
  $("btn-afsluiten").onclick = sluitSessieAf;
  $("btn-kopieer").onclick = function () {
    var ta = $("ov-tekst");
    var klaar = function () { toast("Tekst gekopieerd"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(klaar, function () { ta.select(); toast("Selecteer en kopieer de tekst manueel"); });
    } else { ta.select(); toast("Selecteer en kopieer de tekst manueel"); }
  };

  // Barcodelezer voorbereiden (wasm proberen; anders JS-lezer). Live scannen indien mogelijk.
  Lezer.bereidVoor();
  Lezer.liveMogelijk().then(function (ok) {
    isLive = ok;
    if (ok) { $("scan-uitleg").textContent = "live: richt de camera op de code"; $("lbl-foto").textContent = "Foto"; }
  });

  // Bronvermelding SAM (licentievoorwaarde)
  if (SAM) $("sam-bron").innerHTML = "Geneesmiddelengegevens: <b>" + esc(SAM.bron) + "</b>. Dit hergebruik heeft geen officieel karakter en werd niet goedgekeurd door de beheerders van SAM.";

  // ---------- Start ----------
  statusBalk("laden");
  Opslag.init().then(function (r) { statusBalk(r.modus); });
  toon("s-start");

  // Voor automatische tests
  window.__medscan = { verwerkCode: function (t) { verwerkCode(GS1.parse(t)); }, sessie: function () { return sessie; }, maakPdf: maakPdf };
})();
