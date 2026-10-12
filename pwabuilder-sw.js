// Service worker KSPKT Polsek Jatirogo: aplikasi tetap bisa dibuka tanpa internet.
// Naikkan VERSION setiap kali Anda mengganti index.html agar cache lama dibuang.
var VERSION = "kspkt-v1";

var CORE = ["./", "index.html"];
var LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "lib/html2pdf.bundle.min.js",
  "lib/xlsx.full.min.js"
];

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // Satu file gagal (misalnya folder lib/ belum ada) tidak boleh membatalkan instalasi.
      return Promise.all(CORE.concat(LIBS).map(function (u) {
        return cache.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(req, res) {
  if (res && res.ok) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  var cdn = url.hostname === "cdnjs.cloudflare.com";
  // Permintaan ke Google Apps Script (sinkronisasi Drive) dan situs lain tidak disentuh.
  if (!same && !cdn) return;

  // Buka halaman: pakai versi terbaru kalau online, versi tersimpan kalau offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) { return put("index.html", res); }).catch(function () {
        return caches.match("index.html").then(function (m) { return m || caches.match("./"); });
      })
    );
    return;
  }

  // Pustaka PDF/Excel dari CDN: ambil dari cache dulu.
  if (cdn) {
    event.respondWith(
      caches.match(req).then(function (m) {
        return m || fetch(req).then(function (res) { return put(req, res); });
      })
    );
    return;
  }

  // File lain di situs yang sama: tampilkan yang tersimpan, perbarui di belakang layar.
  event.respondWith(
    caches.match(req).then(function (m) {
      var net = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return m; });
      return m || net;
    })
  );
});
