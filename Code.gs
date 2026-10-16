/**
 * ARSIP SURAT + DOKUMENTASI KSPKT POLSEK JATIROGO
 * Semua data disimpan LANGSUNG di folder Google Drive berikut:
 *   - Database  : file Google Sheets "Arsip KSPKT Jatirogo (Database)"
 *                 (sheet "Arsip" = surat, sheet "Dokumentasi" = kegiatan)
 *   - PDF surat : subfolder "PDF Surat"
 *   - File dokumentasi kegiatan : subfolder "Dokumentasi"
 *   - Laporan orang hilang      : sheet "Orang Hilang" (PDF-nya ikut masuk subfolder "PDF Surat")
 *
 * PENTING: kalau kamu menempel kode ini ke proyek yang sudah ada, PERTAHANKAN
 * nilai TOKEN milikmu sendiri. Setelah menempel: Ctrl+S, jalankan fungsi "setup"
 * sekali, lalu Terapkan > Kelola penerapan > pensil > Versi baru > Terapkan.
 */
var TOKEN = 'jatirogo2026';
var FOLDER_ID = '14NzbERuRjDaHzmUKoCEk1tEEAyJJ_2K3';
var DB_NAME = 'Arsip KSPKT Jatirogo (Database)';
var SHEET_NAME = 'Arsip';
var PDF_FOLDER = 'PDF Surat';
var DOC_SHEET = 'Dokumentasi';
var DOC_FOLDER = 'Dokumentasi';
var USER_SHEET = 'Pengguna';
var OH_SHEET = 'Orang Hilang';
var SM_SHEET = 'Surat Masuk';
var SM_FOLDER = 'Surat Masuk';
var SM_HEAD = ['id', 'No Agenda', 'Tgl Terima', 'Asal Surat', 'Nomor Surat', 'Perihal', 'Sifat', 'Status', 'Disposisi', 'File', 'Link File', 'Disimpan', 'Data (JSON)'];
var OH_HEAD = ['id', 'Nomor Surat', 'Dilaporkan', 'Orang Hilang', 'Pelapor', 'Terakhir Terlihat', 'Status', 'Petugas', 'Dicetak', 'PDF', 'Link PDF', 'Disimpan', 'Data (JSON)'];
var USER_HEAD = ['id', 'Nama', 'Username', 'Peran', 'Pangkat / NRP', 'Dibuat', 'Data (JSON)'];
var HEAD = ['id', 'Nomor Surat', 'Tanggal', 'Pelapor', 'Barang / Surat', 'Petugas', 'Dicetak', 'PDF', 'Link PDF', 'Disimpan', 'Data (JSON)'];
var DOC_HEAD = ['id', 'Tanggal', 'Judul Kegiatan', 'Kategori', 'Keterangan', 'Jumlah File', 'Disimpan', 'Data (JSON)'];

function root_() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (x) {}
  }
  var it = root_().getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName() === DB_NAME) {
      props.setProperty('DB_ID', f.getId());
      return SpreadsheetApp.openById(f.getId());
    }
  }
  var ss = SpreadsheetApp.create(DB_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(root_());
  props.setProperty('DB_ID', ss.getId());
  return ss;
}

function sheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function docSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(DOC_SHEET) || ss.insertSheet(DOC_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(DOC_HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function userSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(USER_SHEET) || ss.insertSheet(USER_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(USER_HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ohSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(OH_SHEET) || ss.insertSheet(OH_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(OH_HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function smSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SM_SHEET) || ss.insertSheet(SM_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(SM_HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function numSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('Nomor') || ss.insertSheet('Nomor');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Tahun', 'Nomor', 'Diklaim', 'Oleh']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function sub_(name) {
  var r = root_();
  var it = r.getFoldersByName(name);
  return it.hasNext() ? it.next() : r.createFolder(name);
}

function folder_() { return sub_(PDF_FOLDER); }
function docFolder_() { return sub_(DOC_FOLDER); }
function smFolder_() { return sub_(SM_FOLDER); }

// File surat masuk hanya boleh dihapus kalau ada di folder "Surat Masuk"
function inSmFolder_(file) {
  var want = smFolder_().getId();
  var ps = file.getParents();
  while (ps.hasNext()) {
    if (ps.next().getId() === want) return true;
  }
  return false;
}

// File hanya boleh diakses/dihapus kalau ada di folder "Dokumentasi"
function inDocFolder_(file) {
  var want = docFolder_().getId();
  var ps = file.getParents();
  while (ps.hasNext()) {
    if (ps.next().getId() === want) return true;
  }
  return false;
}

// Jalankan SEKALI untuk memberi izin dan membuat database + folder
function setup() {
  sheet_();
  docSheet_();
  userSheet_();
  ohSheet_();
  smSheet_();
  numSheet_();
  folder_();
  docFolder_();
  smFolder_();
  Logger.log('Siap. Database dan folder sudah dibuat di folder Drive.');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function rowOf_(sh, id) {
  if (!id) return 0;
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
  return ids.indexOf(id) + 1;
}

// Membaca data
function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out_({ error: 'Kode rahasia salah' });
  var act = e.parameter.action || '';

  if (act === 'doclist') {
    var drows = docSheet_().getDataRange().getValues();
    var docs = [];
    for (var j = 1; j < drows.length; j++) {
      try { docs.push(JSON.parse(drows[j][7])); } catch (x) {}
    }
    return out_({ docs: docs });
  }

  if (act === 'userlist') {
    var urows = userSheet_().getDataRange().getValues();
    var users = [];
    for (var k = 1; k < urows.length; k++) {
      try { users.push(JSON.parse(urows[k][6])); } catch (x) {}
    }
    return out_({ users: users });
  }

  if (act === 'ohlist') {
    var orows = ohSheet_().getDataRange().getValues();
    var oh = [];
    for (var m = 1; m < orows.length; m++) {
      try { oh.push(JSON.parse(orows[m][12])); } catch (x) {}
    }
    return out_({ oh: oh });
  }

  if (act === 'smlist') {
    var srows = smSheet_().getDataRange().getValues();
    var sm = [];
    for (var q = 1; q < srows.length; q++) {
      try { sm.push(JSON.parse(srows[q][12])); } catch (x) {}
    }
    return out_({ sm: sm });
  }

  if (act === 'docget') {
    try {
      var f = DriveApp.getFileById(e.parameter.id);
      if (!inDocFolder_(f)) return out_({ error: 'File tidak ditemukan' });
      var b = f.getBlob();
      return out_({ name: f.getName(), type: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) });
    } catch (x) {
      return out_({ error: 'File tidak ditemukan' });
    }
  }

  var rows = sheet_().getDataRange().getValues();
  var recs = [];
  for (var i = 1; i < rows.length; i++) {
    try { recs.push(JSON.parse(rows[i][10])); } catch (x) {}
  }
  return out_({ records: recs });
}

// Menyimpan / menghapus
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ error: 'Data tidak valid' }); }
  if (b.token !== TOKEN) return out_({ error: 'Kode rahasia salah' });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var act = b.action;

    // ----- Nomor urut surat (anti ganda) -----
    if (act === 'claimNo') {
      var nsh = numSheet_();
      var yr = +b.year;
      var want = +b.urut || 1;
      var used = {};
      var mx = 0;
      var nrows = nsh.getLastRow() > 1 ? nsh.getRange(2, 1, nsh.getLastRow() - 1, 2).getValues() : [];
      nrows.forEach(function (r) {
        if (+r[0] === yr) { used[+r[1]] = 1; if (+r[1] > mx) mx = +r[1]; }
      });
      var ash = sheet_();
      var arows = ash.getLastRow() > 1 ? ash.getRange(2, 2, ash.getLastRow() - 1, 1).getValues() : [];
      arows.forEach(function (r) {
        var m = String(r[0]).match(/(?:B|SKTLK)\/\s*(\d+)\s*\/.*?\/\s*(\d{4})\s*\/\s*Polsek/);
        if (m && +m[2] === yr) { used[+m[1]] = 1; if (+m[1] > mx) mx = +m[1]; }
      });
      var nn = (want > 0 && !used[want]) ? want : mx + 1;
      nsh.appendRow([yr, nn, new Date(), b.by || '']);
      return out_({ ok: true, no: nn, changed: nn !== want });
    }

    // ----- Akun petugas -----
    if (act === 'userSave') {
      var ush = userSheet_();
      var u = b.record;
      var uvals = [u.id, u.nama, u.user, u.role, u.nrp || '', new Date(u.created || Date.now()), JSON.stringify(u)];
      var urow = rowOf_(ush, u.id);
      if (urow > 1) ush.getRange(urow, 1, 1, uvals.length).setValues([uvals]);
      else ush.appendRow(uvals);
      return out_({ ok: true });
    }
    if (act === 'userDelete') {
      var ush2 = userSheet_();
      var urow2 = rowOf_(ush2, b.id);
      if (urow2 > 1) ush2.deleteRow(urow2);
      return out_({ ok: true });
    }

    // ----- Dokumentasi kegiatan -----
    if (act === 'docUpload') {
      var blob0 = Utilities.newBlob(Utilities.base64Decode(b.data), b.type || 'application/octet-stream', b.name);
      var f0 = docFolder_().createFile(blob0);
      return out_({ ok: true, fileId: f0.getId(), url: f0.getUrl(), size: f0.getSize() });
    }
    if (act === 'docSave') {
      var dsh = docSheet_();
      var d = b.record;
      var dvals = [d.id, d.tgl, d.judul, d.kat, d.ket, (d.files || []).length, new Date(d.saved || Date.now()), JSON.stringify(d)];
      var drow = rowOf_(dsh, d.id);
      if (drow > 1) dsh.getRange(drow, 1, 1, dvals.length).setValues([dvals]);
      else dsh.appendRow(dvals);
      return out_({ ok: true });
    }
    if (act === 'docTrash') {
      try {
        var tf = DriveApp.getFileById(b.fileId);
        if (inDocFolder_(tf)) tf.setTrashed(true);
      } catch (x) {}
      return out_({ ok: true });
    }
    if (act === 'docDelete') {
      var dsh2 = docSheet_();
      var drow2 = rowOf_(dsh2, b.id);
      if (drow2 > 1) {
        try {
          var rec = JSON.parse(dsh2.getRange(drow2, 8).getValue());
          (rec.files || []).forEach(function (fl) {
            try {
              var ff = DriveApp.getFileById(fl.fileId);
              if (inDocFolder_(ff)) ff.setTrashed(true);
            } catch (x) {}
          });
        } catch (x) {}
        dsh2.deleteRow(drow2);
      }
      return out_({ ok: true });
    }

    // ----- Surat masuk + disposisi -----
    if (act === 'smUpload') {
      var sblob = Utilities.newBlob(Utilities.base64Decode(b.data), b.type || 'application/octet-stream', b.name);
      var sf = smFolder_().createFile(sblob);
      return out_({ ok: true, fileId: sf.getId(), url: sf.getUrl(), size: sf.getSize() });
    }
    if (act === 'smTrash') {
      try {
        var stf = DriveApp.getFileById(b.fileId);
        if (inSmFolder_(stf)) stf.setTrashed(true);
      } catch (x) {}
      return out_({ ok: true });
    }
    if (act === 'smSave') {
      var ssh = smSheet_();
      var m = b.record;
      var mjs = JSON.stringify(m);
      if (mjs.length > 49000) return out_({ error: 'Data surat terlalu besar. Persingkat ringkasan / catatan disposisi.' });
      var mvals = [m.id, m.no || '', m.tglterima || '', m.asal || '', m.nomor || '', m.perihal || '', m.sifat || '',
        m.status || 'baru', (m.dispo || []).length, m.file ? 'Ya' : 'Belum', (m.file && m.file.url) || '',
        new Date(m.saved || Date.now()), mjs];
      var mrow = rowOf_(ssh, m.id);
      if (mrow > 1) ssh.getRange(mrow, 1, 1, mvals.length).setValues([mvals]);
      else ssh.appendRow(mvals);
      return out_({ ok: true });
    }
    if (act === 'smDelete') {
      var ssh2 = smSheet_();
      var mrow2 = rowOf_(ssh2, b.id);
      if (mrow2 > 1) {
        try {
          var mrec = JSON.parse(ssh2.getRange(mrow2, 13).getValue());
          var ids = [];
          if (mrec.file && mrec.file.fileId) ids.push(mrec.file.fileId);
          (mrec.dispo || []).forEach(function (dd) { if (dd.pdf && dd.pdf.fileId) ids.push(dd.pdf.fileId); });
          ids.forEach(function (fid) {
            try {
              var mff = DriveApp.getFileById(fid);
              if (inSmFolder_(mff)) mff.setTrashed(true);
            } catch (x) {}
          });
        } catch (x) {}
        ssh2.deleteRow(mrow2);
      }
      return out_({ ok: true });
    }

    // ----- Laporan orang hilang -----
    if (act === 'ohSave') {
      var osh = ohSheet_();
      var o = b.record;
      var ojs = JSON.stringify(o);
      if (ojs.length > 49000) return out_({ error: 'Data laporan terlalu besar (kemungkinan foto). Perkecil foto lalu simpan lagi.' });
      var ovals = [o.id, o.no, o.waktu, o.nama, o.pelapor || '', o.tlihat || '', o.status || 'cari', o.petugas || '',
        o.cetak ? 'Ya' : 'Belum', o.pdf ? 'Ya' : 'Belum', o.pdfUrl || '', new Date(o.saved || Date.now()), ojs];
      var orow = rowOf_(osh, o.id);
      if (orow > 1) osh.getRange(orow, 1, 1, ovals.length).setValues([ovals]);
      else osh.appendRow(ovals);
      return out_({ ok: true });
    }
    if (act === 'ohDelete') {
      var osh2 = ohSheet_();
      var orow2 = rowOf_(osh2, b.id);
      if (orow2 > 1) osh2.deleteRow(orow2);
      return out_({ ok: true });
    }

    // ----- Arsip surat -----
    var sh = sheet_();
    var id = act === 'save' ? (b.record && b.record.id) : b.id;
    var row = rowOf_(sh, id);

    if (act === 'save') {
      var r = b.record;
      var vals = [r.id, r.no, r.waktu, r.nama, r.barang, r.petugas,
        r.cetak ? 'Ya' : 'Belum', r.pdf ? 'Ya' : 'Belum', r.pdfUrl || '',
        new Date(r.saved || Date.now()), JSON.stringify(r)];
      if (row > 1) sh.getRange(row, 1, 1, vals.length).setValues([vals]);
      else sh.appendRow(vals);
      return out_({ ok: true });
    }

    if (act === 'delete') {
      if (row > 1) sh.deleteRow(row);
      return out_({ ok: true });
    }

    if (act === 'pdf') {
      if (b.oldFileId) {
        try { DriveApp.getFileById(b.oldFileId).setTrashed(true); } catch (x) {}
      }
      var blob = Utilities.newBlob(Utilities.base64Decode(b.data), 'application/pdf', b.filename);
      var f = folder_().createFile(blob);
      return out_({ ok: true, url: f.getUrl(), fileId: f.getId() });
    }

    return out_({ error: 'Aksi tidak dikenal' });
  } finally {
    lock.releaseLock();
  }
}
