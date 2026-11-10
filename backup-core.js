// Backup & pulih tanda "Dah ada" (dan data tools percuma) yang disimpan dalam localStorage browser.
// Tiada data dihantar ke mana-mana: fail/kod dijana dan dibaca dalam browser pengguna sahaja.
// Format: { app: "ftm-by-ayot", jenis: "backup", v: 1, dibuat: ISO, data: { "<key ftm-...>": "<nilai asal localStorage>" } }
// Kod salin = "FTM1." + base64url(JSON) supaya boleh dihantar melalui WhatsApp ke diri sendiri.
(function (root) {
  "use strict";
  var APP = "ftm-by-ayot", V = 1, PREFIX = "FTM1.";
  // Senarai key yang dibenarkan. Tool baru yang menyimpan data mesti ditambah di sini dan dalam merge().
  var KEY_RE = /^(ftm-set:[a-z0-9][a-z0-9-]{0,60}|ftm-taska:v1|ftm-names:fav|ftm-milestone:v1|ftm-imunisasi:v1|ftm-profil:v1)$/;
  var TAK_SELAMAT = ["__proto__", "constructor", "prototype"];
  var MAX_CUSTOM = 30;
  var MAX_TOTAL = 500000, MAX_VALUE = 100000;

  function keysOf(storage) {
    var out = [];
    for (var i = 0; i < storage.length; i++) { var k = storage.key(i); if (k && KEY_RE.test(k)) out.push(k); }
    return out.sort();
  }

  // Kumpul semua key ftm-* yang sah (nilai mesti JSON) daripada storage.
  function collect(storage, now) {
    var data = {};
    keysOf(storage).forEach(function (k) {
      var v = storage.getItem(k);
      if (typeof v !== "string" || v.length > MAX_VALUE) return;
      try { JSON.parse(v); data[k] = v; } catch (e) { /* nilai rosak tidak dibackup */ }
    });
    return { app: APP, jenis: "backup", v: V, dibuat: (now || new Date()).toISOString(), data: data };
  }

  function utf8ToB64url(s) {
    var bin = unescape(encodeURIComponent(s));
    return btoaAny(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlToUtf8(s) {
    var b = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return decodeURIComponent(escape(atobAny(b)));
  }
  function btoaAny(bin) { return typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64"); }
  function atobAny(b) { return typeof atob === "function" ? atob(b) : Buffer.from(b, "base64").toString("binary"); }

  function toJson(backup) { return JSON.stringify(backup, null, 1); }
  function toCode(backup) { return PREFIX + utf8ToB64url(JSON.stringify(backup)); }

  // Baca teks fail (JSON) atau kod FTM1. Pulangkan { ok, backup, dibuang } atau { ok: false, ralat }.
  function parse(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) return { ok: false, ralat: "Tiada isi. Pilih fail backup atau tampal kod." };
    if (t.length > MAX_TOTAL * 2) return { ok: false, ralat: "Fail terlalu besar untuk backup FTM." };
    var obj;
    try {
      if (t.indexOf(PREFIX) === 0) obj = JSON.parse(b64urlToUtf8(t.slice(PREFIX.length).replace(/\s+/g, "")));
      else obj = JSON.parse(t);
    } catch (e) { return { ok: false, ralat: "Fail atau kod ini bukan backup FTM, atau tidak lengkap. Cuba salin semula kod penuh." }; }
    if (!obj || typeof obj !== "object" || obj.app !== APP || obj.jenis !== "backup") return { ok: false, ralat: "Ini bukan backup FTM by Ayot." };
    if (obj.v !== V) return { ok: false, ralat: "Versi backup tidak dikenali. Cuba buat backup baru." };
    if (!obj.data || typeof obj.data !== "object" || Array.isArray(obj.data)) return { ok: false, ralat: "Backup ini kosong atau rosak." };
    var data = {}, dibuang = 0, total = 0;
    Object.keys(obj.data).forEach(function (k) {
      var v = obj.data[k];
      if (!KEY_RE.test(k) || typeof v !== "string" || v.length > MAX_VALUE) { dibuang++; return; }
      try { JSON.parse(v); } catch (e) { dibuang++; return; }
      total += v.length;
      data[k] = v;
    });
    if (total > MAX_TOTAL) return { ok: false, ralat: "Backup terlalu besar." };
    if (!Object.keys(data).length) return { ok: false, ralat: "Backup ini tiada tanda untuk dipulihkan." };
    var d = new Date(obj.dibuat);
    return { ok: true, backup: { app: APP, jenis: "backup", v: V, dibuat: isNaN(d) ? null : d.toISOString(), data: data }, dibuang: dibuang };
  }

  function bacaObjek(raw) {
    try { var o = JSON.parse(raw); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch (e) { return null; }
  }
  function bacaSenarai(raw) {
    try { var a = JSON.parse(raw); return Array.isArray(a) ? a : null; } catch (e) { return null; }
  }
  // Salin id bertanda (nilai true sahaja) ke out. Objek null-proto, jadi key pelik tidak boleh mencemar prototaip.
  function salinTanda(out, o) {
    Object.keys(o && typeof o === "object" ? o : {}).forEach(function (id) {
      if (o[id] === true && TAK_SELAMAT.indexOf(id) < 0) out[id] = true;
    });
    return out;
  }
  function kesatuan(a, b) { return salinTanda(salinTanda(Object.create(null), a), b); }

  function gabungTaska(d, s) {
    var custom = [], ada = Object.create(null);
    [d.custom, s.custom].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (c) {
        if (!c || typeof c.id !== "string" || typeof c.cat !== "string" || typeof c.name !== "string") return;
        if (ada[c.id] || custom.length >= MAX_CUSTOM || TAK_SELAMAT.indexOf(c.id) >= 0) return;
        ada[c.id] = true;
        custom.push({ id: c.id, cat: c.cat, name: c.name });
      });
    });
    return { ticks: kesatuan(d.ticks, s.ticks), custom: custom, hidden: kesatuan(d.hidden, s.hidden) };
  }

  // Perkembangan & Imunisasi: tarikh lahir atau negeri berbeza mungkin bermaksud anak lain, jadi tidak digabung automatik.
  function gabungRekod(d, s) {
    if ((d.dob && s.dob && d.dob !== s.dob) || (d.state && s.state && d.state !== s.state)) return null;
    var done = Object.create(null);
    [s.done, d.done].forEach(function (o) {
      Object.keys(o && typeof o === "object" ? o : {}).forEach(function (id) { if (TAK_SELAMAT.indexOf(id) < 0) done[id] = o[id]; });
    });
    var out = { dob: d.dob || s.dob || "" };
    if ("state" in d || "state" in s) out.state = d.state || s.state || "";
    out.done = done;
    return out;
  }

  // Profil Hari Ini: satu tarikh sahaja. Jika berbeza, profil dalam browser ini dikekalkan (dikira konflik).
  function gabungProfil(d, s) {
    if (!d || !d.jenis) return s;
    return d.jenis === s.jenis && d.tarikh === s.tarikh ? d : null;
  }

  // Gabung nilai mentah dest (dalam browser ini, atau null) dengan src (dari backup). Tiada tanda hilang, dan
  // gabung dua kali beri hasil sama. Pulangkan { nilai: rentetan atau null jika tiada apa ditulis } atau { konflik: true }.
  function merge(key, dest, src) {
    var hasil;
    if (key === "ftm-names:fav") {
      var sumber = bacaSenarai(src);
      if (!sumber) return { nilai: null };
      hasil = [];
      (bacaSenarai(dest) || []).concat(sumber).forEach(function (n) { if (typeof n === "string" && hasil.indexOf(n) < 0) hasil.push(n); });
    } else {
      var s = bacaObjek(src), d = bacaObjek(dest);
      if (!s) return { nilai: null };
      if (key.indexOf("ftm-set:") === 0) hasil = kesatuan(d, s);
      else if (key === "ftm-taska:v1") hasil = gabungTaska(d || {}, s);
      else if (key === "ftm-profil:v1") {
        hasil = gabungProfil(d, s);
        if (!hasil) return { konflik: true };
      }
      else if (key === "ftm-milestone:v1" || key === "ftm-imunisasi:v1") {
        hasil = gabungRekod(d || {}, s);
        if (!hasil) return { konflik: true };
      } else return { nilai: null };
    }
    return { nilai: JSON.stringify(hasil) };
  }

  function adaIsi(v) {
    if (Array.isArray(v)) return v.some(adaIsi);
    if (v && typeof v === "object") return Object.keys(v).some(function (k) { return adaIsi(v[k]); });
    return !!v;
  }
  // Benar jika backup ada data sebenar. { ticks: {}, custom: [] } yang kosong tidak dikira.
  function adaData(backup) {
    return Object.keys(backup.data).some(function (k) {
      try { return adaIsi(JSON.parse(backup.data[k])); } catch (e) { return false; }
    });
  }

  // Ringkasan untuk dipaparkan: bilangan set checklist yang ada sekurang-kurangnya satu tanda, dan data tools lain.
  function summary(backup) {
    var sets = 0, tanda = 0, tools = 0;
    Object.keys(backup.data).forEach(function (k) {
      if (k.indexOf("ftm-set:") === 0) {
        var n = 0;
        try { var o = JSON.parse(backup.data[k]); for (var id in o) if (o[id] === true) n++; } catch (e) {}
        if (n) { sets++; tanda += n; }
      } else {
        try { if (adaIsi(JSON.parse(backup.data[k]))) tools++; } catch (e) {}
      }
    });
    return { sets: sets, tanda: tanda, tools: tools };
  }

  // Gabung backup ke dalam storage (key lain tidak disentuh), kemudian baca semula untuk sahkan.
  // Jika gagal di tengah jalan, semua kembali seperti asal. Pulangkan { ok, n: bilangan key digabung, konflik }.
  function apply(storage, backup) {
    var rancangan = [], n = 0, konflik = 0;
    try {
      Object.keys(backup.data).forEach(function (k) {
        if (!KEY_RE.test(k)) return;
        var asal = storage.getItem(k), m = merge(k, asal, backup.data[k]);
        if (m.konflik) { konflik++; return; }
        if (m.nilai === null) return;
        n++;
        if (m.nilai !== asal) rancangan.push({ k: k, asal: asal, nilai: m.nilai });
      });
    } catch (e) { return { ok: false, n: 0, konflik: konflik }; }
    var ditulis = [];
    try {
      rancangan.forEach(function (r) {
        ditulis.push(r);
        storage.setItem(r.k, r.nilai);
        if (storage.getItem(r.k) !== r.nilai) throw new Error("baca semula tidak sama");
      });
    } catch (e) {
      ditulis.forEach(function (r) {
        try { if (r.asal === null) storage.removeItem(r.k); else storage.setItem(r.k, r.asal); } catch (e2) {}
      });
      return { ok: false, n: 0, konflik: konflik };
    }
    return { ok: true, n: n, konflik: konflik };
  }

  function fileName(now) { return "ftm-backup-" + (now || new Date()).toISOString().slice(0, 10) + ".json"; }

  root.BackupCore = { collect: collect, toJson: toJson, toCode: toCode, parse: parse, summary: summary, adaData: adaData, merge: merge, apply: apply, fileName: fileName, KEY_RE: KEY_RE, PREFIX: PREFIX };
})(typeof window !== "undefined" ? window : globalThis);
