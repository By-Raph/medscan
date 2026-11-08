/*
 * Barcodelezer met twee motoren:
 *  1. zxing-wasm (snel en sterk), als het .wasm-bestand geladen kan worden.
 *     Binnen een claude.ai-artifact blokkeert de beveiliging (CSP) dat ophalen.
 *  2. @zxing/library (puur JavaScript, geen ophalen nodig): werkt altijd.
 *     Zwakker bij kleine codes, daarom zoekt hij ook in uitsneden (tegels) van de foto.
 *
 * Resultaat: lijst { text, format } (format: "DataMatrix", "EAN13", ...).
 */
(function (root) {
  "use strict";

  var WASM_URL = "https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.6/dist/reader/zxing_reader.wasm";
  var WASM_OPTIES = { textMode: "HRI", formats: ["DataMatrix", "EAN13", "EAN8", "Code128", "Code39"], tryHarder: true, maxNumberOfSymbols: 4 };
  var wasmStatus = "onbekend"; // "onbekend" | "ok" | "kapot"
  var laatsteMotor = null;
  var wasmKlaar = Promise.resolve(false);

  function bereidVoor() {
    if (!root.ZXingWASM || !root.ZXingWASM.prepareZXingModule) { wasmStatus = "kapot"; return; }
    try {
      wasmKlaar = root.ZXingWASM.prepareZXingModule({
        overrides: { locateFile: function (pad, prefix) { return pad.slice(-5) === ".wasm" ? WASM_URL : prefix + pad; } },
        fireImmediately: true
      }).then(function () { wasmStatus = "ok"; return true; }, function (e) { wasmStatus = "kapot"; console.info("[lezer] wasm niet beschikbaar, JS-lezer wordt gebruikt", e && e.message); return false; });
    } catch (e) { wasmStatus = "kapot"; }
  }

  // ---------- Motor 2: @zxing/library ----------
  var FORMAT_NAAM = {};
  function jsLezer() {
    var Z = root.ZXing;
    var hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    FORMAT_NAAM[Z.BarcodeFormat.DATA_MATRIX] = "DataMatrix"; FORMAT_NAAM[Z.BarcodeFormat.EAN_13] = "EAN13";
    FORMAT_NAAM[Z.BarcodeFormat.EAN_8] = "EAN8"; FORMAT_NAAM[Z.BarcodeFormat.CODE_128] = "Code128"; FORMAT_NAAM[Z.BarcodeFormat.CODE_39] = "Code39";
    var lezer = new Z.MultiFormatReader();
    lezer.setHints(hints);
    return { Z: Z, lezer: lezer };
  }

  function probeer(js, lum, w, h, binarizers, ookOmgekeerd) {
    var varianten = [];
    binarizers.forEach(function (b) { varianten.push([b, false]); if (ookOmgekeerd) varianten.push([b, true]); });
    for (var i = 0; i < varianten.length; i++) {
      try {
        var bron = new js.Z.RGBLuminanceSource(lum, w, h);
        if (varianten[i][1]) bron = new js.Z.InvertedLuminanceSource(bron); // lichte code op donkere achtergrond
        var res = js.lezer.decode(new js.Z.BinaryBitmap(new varianten[i][0](bron)));
        return { text: res.getText(), format: FORMAT_NAAM[res.getBarcodeFormat()] || String(res.getBarcodeFormat()) };
      } catch (e) { /* niets gevonden */ } finally { try { js.lezer.reset(); } catch (e2) { /* negeren */ } }
    }
    return null;
  }

  // Grijswaarden uit een canvas-uitsnede.
  function grijs(ctx, x, y, w, h) {
    var d = ctx.getImageData(x, y, w, h).data, l = new Uint8ClampedArray(w * h);
    for (var i = 0, j = 0; i < l.length; i++, j += 4) l[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000;
    return l;
  }
  // Uitsnede uit een grijswaardenbeeld (W breed).
  function uitsnede(l, W, x, y, w, h) {
    var o = new Uint8ClampedArray(w * h);
    for (var j = 0; j < h; j++) o.set(l.subarray((y + j) * W + x, (y + j) * W + x + w), j * w);
    return o;
  }
  // Verkleinen door middelen (snel genoeg voor 1 keer per foto).
  function verklein(l, W, H, f) {
    var w = Math.floor(W / f), h = Math.floor(H / f), o = new Uint8ClampedArray(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0;
      for (var dy = 0; dy < f; dy++) for (var dx = 0; dx < f; dx++) s += l[(y * f + dy) * W + x * f + dx];
      o[y * w + x] = s / (f * f);
    }
    return { l: o, w: w, h: h };
  }
  var pauze = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  async function laadBeeld(bestand) {
    if (root.createImageBitmap) {
      try { return await createImageBitmap(bestand); } catch (e) { /* val terug op <img> */ }
    }
    return await new Promise(function (ok, nok) {
      var img = new Image(), url = URL.createObjectURL(bestand);
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); nok(new Error("Foto kon niet geopend worden")); };
      img.src = url;
    });
  }

  async function leesJs(bestand, voortgang) {
    if (!root.ZXing) throw new Error("De barcodelezer kon niet geladen worden (geen internet?).");
    var js = jsLezer();
    var beeld = await laadBeeld(bestand);
    var bw = beeld.width, bh = beeld.height;
    var schaal = Math.min(1, 3000 / Math.max(bw, bh));
    var W = Math.round(bw * schaal), H = Math.round(bh * schaal);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(beeld, 0, 0, W, H);
    var l = grijs(ctx, 0, 0, W, H);
    c.width = c.height = 1; // geheugen vrijgeven (iOS)
    var HB = js.Z.HybridBinarizer, GB = js.Z.GlobalHistogramBinarizer;

    // 1. Volledig beeld (verkleind) en 2. volledige resolutie
    var f = Math.max(1, Math.round(Math.max(W, H) / 1600));
    var klein = f > 1 ? verklein(l, W, H, f) : { l: l, w: W, h: H };
    var r = probeer(js, klein.l, klein.w, klein.h, [HB, GB], true);
    if (r) return [r];
    await pauze();
    if (f > 1) { r = probeer(js, l, W, H, [HB], true); if (r) return [r]; }

    // 3. Tegels: overlappende uitsneden, eerst groot (40%), dan klein (25%), midden eerst
    var formaten = [0.4, 0.25];
    for (var k = 0; k < formaten.length; k++) {
      var tw = Math.round(W * formaten[k]), th = Math.round(H * formaten[k]);
      var stapX = Math.round(tw / 2), stapY = Math.round(th / 2), tegels = [];
      for (var y = 0; y + th <= H; y += stapY) for (var x = 0; x + tw <= W; x += stapX) tegels.push([x, y]);
      var mx = W / 2, my = H / 2;
      tegels.sort(function (a, b) {
        return Math.hypot(a[0] + tw / 2 - mx, a[1] + th / 2 - my) - Math.hypot(b[0] + tw / 2 - mx, b[1] + th / 2 - my);
      });
      for (var t = 0; t < tegels.length; t++) {
        if (voortgang) voortgang("Zoeken in de foto… " + Math.round(((k + t / tegels.length) / formaten.length) * 100) + "%");
        r = probeer(js, uitsnede(l, W, tegels[t][0], tegels[t][1], tw, th), tw, th, [HB]);
        if (r) return [r];
        if (t % 3 === 2) await pauze();
      }
    }
    return [];
  }

  async function lees(bestand, voortgang) {
    if (wasmStatus !== "kapot" && root.ZXingWASM) {
      try {
        var res = await root.ZXingWASM.readBarcodes(bestand, WASM_OPTIES);
        wasmStatus = "ok"; laatsteMotor = "wasm";
        return res.filter(function (x) { return x.isValid !== false; }).map(function (x) { return { text: x.text, format: x.format }; });
      } catch (e) {
        wasmStatus = "kapot";
        console.info("[lezer] wasm faalt, overschakelen op JS-lezer:", e && e.message);
      }
    }
    laatsteMotor = "js";
    return await leesJs(bestand, voortgang);
  }

  // Eén videoframe lezen (enkel wasm: de JS-lezer is te traag en te zwak voor live gebruik).
  async function leesFrame(imageData) {
    var res = await root.ZXingWASM.readBarcodes(imageData, { textMode: "HRI", formats: WASM_OPTIES.formats, tryHarder: true, maxNumberOfSymbols: 1 });
    return res.filter(function (x) { return x.isValid !== false; }).map(function (x) { return { text: x.text, format: x.format }; });
  }

  // Live scannen kan enkel met camera-toegang (HTTPS, geen claude.ai-artifact) en een werkende wasm.
  async function liveMogelijk() {
    if (!(root.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return false;
    if (wasmStatus === "onbekend") await wasmKlaar;
    return wasmStatus === "ok";
  }

  root.Lezer = {
    bereidVoor: bereidVoor, lees: lees, leesFrame: leesFrame, liveMogelijk: liveMogelijk,
    motor: function () { return laatsteMotor || (wasmStatus === "kapot" ? "js" : "wasm?"); }
  };
})(window);
