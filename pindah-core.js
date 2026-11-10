// Logik pindah data dari alamat lama ke alamat baru (tanpa DOM). Dipakai oleh halaman lama (tools/shim), site/pindah/ dan ujian Node.
// Data dihantar dalam #fragment URL pada tab yang sama: fragment tidak pernah sampai ke server, dan browser tetap sama.
(function (root) {
  "use strict";
  var LAMA = "https://ftmbyayot.github.io", BARU = "https://ftmbyayot.senangcarisolutions.com";
  var KEY_STATUS = "ftm.pindah.v1"; // bertitik supaya tidak termasuk dalam backup (lihat KEY_RE dalam backup-core.js)
  var NONCE_RE = /^[a-f0-9]{32}$/;
  var MAX_KOD = 30000; // lebih panjang daripada ini guna fail backup: had URL berbeza ikut browser

  // Hanya path dalam laman yang sama. Elak //evil.com dan \\evil.com menjadi redirect keluar.
  function pathSelamat(p) {
    return typeof p === "string" && p.length <= 512 && /^\/(?![\/\\])/.test(p) && !/[\\\s]/.test(p) ? p : "/";
  }

  function bacaHash(hash) {
    var out = Object.create(null);
    String(hash || "").replace(/^#/, "").split("&").forEach(function (bahagian) {
      var i = bahagian.indexOf("=");
      if (i < 1) { if (bahagian) out[bahagian] = ""; return; }
      try { out[bahagian.slice(0, i)] = decodeURIComponent(bahagian.slice(i + 1)); } catch (e) {}
    });
    return out;
  }

  function hantarUrl(kod, nonce, path) {
    return BARU + "/pindah/#d=" + kod + "&n=" + nonce + "&p=" + encodeURIComponent(pathSelamat(path));
  }
  function bacaHantaran(hash) {
    var h = bacaHash(hash);
    if (!h.d || !NONCE_RE.test(h.n || "")) return null;
    return { kod: h.d, nonce: h.n, path: pathSelamat(h.p) };
  }

  function ackUrl(nonce) { return LAMA + "/#pindah-ok=" + nonce; }
  function bacaAck(hash) {
    var n = bacaHash(hash)["pindah-ok"];
    return NONCE_RE.test(n || "") ? n : null;
  }

  // Hantar semula: dibuka dari notis di alamat baru, bila tanda di sana hilang walaupun pernah dipindah.
  function semulaUrl() { return LAMA + "/#hantar-semula"; }
  function bacaSemula(hash) { return "hantar-semula" in bacaHash(hash); }
  function tiadaUrl() { return BARU + "/pindah/#tiada"; }
  function bacaTiada(hash) { return "tiada" in bacaHash(hash); }

  function siapUrl(path) { return BARU + "/pindah/#siap&p=" + encodeURIComponent(pathSelamat(path)); }
  function bacaSiap(hash) {
    var h = bacaHash(hash);
    return "siap" in h ? { path: pathSelamat(h.p) } : null;
  }

  // Import terus hanya jika pengguna datang dari alamat lama. Link palsu dari tempat lain perlu pengesahan pengguna.
  function dariLama(referrer) {
    var r = String(referrer || "");
    return r === LAMA || r.indexOf(LAMA + "/") === 0;
  }

  // Keputusan halaman lama: "siap" (rekod selesai), "terus" (redirect) atau "tawar" (papar butang pindah).
  // semula = pengguna minta hantar semula, jadi status "selesai" tidak menutup butang.
  function keputusan(o) {
    var st = o.status;
    if (o.ack && st && st.nonce === o.ack) return "siap";
    if (!o.semula && st && st.status === "selesai") return "terus";
    return o.adaData ? "tawar" : "terus";
  }

  // Minta browser jangan padam data laman ini bila storan rendah. Tiada jaminan: jika tetap terpadam, pengguna boleh hantar semula.
  function mintaKekal(nav) {
    try { if (nav && nav.storage && nav.storage.persist) return nav.storage.persist().catch(function () { return false; }); } catch (e) {}
    return Promise.resolve(false);
  }

  function muat(kod) { return String(kod).length <= MAX_KOD; }

  root.PindahCore = { LAMA: LAMA, BARU: BARU, KEY_STATUS: KEY_STATUS, pathSelamat: pathSelamat, hantarUrl: hantarUrl, bacaHantaran: bacaHantaran,
    ackUrl: ackUrl, bacaAck: bacaAck, semulaUrl: semulaUrl, bacaSemula: bacaSemula, tiadaUrl: tiadaUrl, bacaTiada: bacaTiada, siapUrl: siapUrl, bacaSiap: bacaSiap,
    dariLama: dariLama, keputusan: keputusan, mintaKekal: mintaKekal, muat: muat };
})(typeof window !== "undefined" ? window : globalThis);
