// Halaman di alamat lama (ftmbyayot.github.io). Data pengguna ada dalam browser bawah alamat ini, jadi ia dibaca dahulu sebelum redirect.
// Data di sini tidak pernah dipadam.
(function () {
  "use strict";
  var B = window.BackupCore, P = window.PindahCore, $ = function (id) { return document.getElementById(id); };

  var store = null;
  try { store = window.localStorage; store.getItem(P.KEY_STATUS); } catch (e) { store = null; }

  var ack = P.bacaAck(location.hash), semula = P.bacaSemula(location.hash);
  var path = location.pathname + location.search + (ack || semula ? "" : location.hash);
  var status = null;
  if (store) { try { status = JSON.parse(store.getItem(P.KEY_STATUS)); } catch (e) {} }
  var backup = store ? B.collect(store) : null;

  var adaData = !!backup && B.adaData(backup);
  var langkah = P.keputusan({ ack: ack, status: status, adaData: adaData, semula: semula });

  if (langkah === "siap") {
    try { store.setItem(P.KEY_STATUS, JSON.stringify({ status: "selesai", nonce: status.nonce, path: status.path, pada: new Date().toISOString() })); } catch (e) {}
    location.replace(P.siapUrl(status.path));
    return;
  }
  if (langkah === "terus") { location.replace(semula && !adaData ? P.tiadaUrl() : P.BARU + P.pathSelamat(path)); return; }

  var s = B.summary(backup), parts = [];
  if (s.sets) parts.push(s.sets + " set bertanda (" + s.tanda + " barang)");
  if (s.tools) parts.push(s.tools + " data tools");
  $("ringkasan").textContent = "Dalam browser ini: " + parts.join(" dan ") + ".";
  $("baru").textContent = P.BARU.replace(/^https?:\/\//, "");
  $("tawar").hidden = false;

  var simpanFail = function () {
    var url = URL.createObjectURL(new Blob([B.toJson(backup)], { type: "application/json" }));
    var a = document.createElement("a");
    a.href = url; a.download = B.fileName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $("mesej").textContent = "Fail " + B.fileName() + " disimpan dalam folder Downloads / Files. Pulihkan di " + P.BARU.replace(/^https?:\/\//, "") + "/bantuan/.";
  };
  $("simpan").addEventListener("click", simpanFail);

  $("pindah").addEventListener("click", function () {
    var kod = B.toCode(backup);
    if (!P.muat(kod)) { $("mesej").textContent = "Data awak terlalu besar untuk dipindah terus. Tekan Simpan fail backup, kemudian pulihkan di alamat baru."; return; }
    var rawak = new Uint8Array(16);
    crypto.getRandomValues(rawak);
    var nonce = Array.prototype.map.call(rawak, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    var tujuan = P.pathSelamat(path);
    try {
      store.setItem(P.KEY_STATUS, JSON.stringify({ status: "dihantar", nonce: nonce, path: tujuan, pada: new Date().toISOString() }));
    } catch (e) { $("mesej").textContent = "Browser tidak dapat menyimpan status. Tekan Simpan fail backup, kemudian pulihkan di alamat baru."; return; }
    location.href = P.hantarUrl(kod, nonce, tujuan);
  });
})();
