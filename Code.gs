/**
 * ARSIP SURAT + DOKUMENTASI KSPKT POLSEK JATIROGO
 * Semua data disimpan LANGSUNG di folder Google Drive berikut:
 *   - Database  : file Google Sheets "Arsip KSPKT Jatirogo (Database)"
 *                 (sheet "Arsip" = surat, sheet "Dokumentasi" = kegiatan)
 *   - PDF surat : subfolder "PDF Surat"
 *   - File dokumentasi kegiatan : subfolder "Dokumentasi"
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

function sub_(name) {
  var r = root_();
  var it = r.getFoldersByName(name);
  return it.hasNext() ? it.next() : r.createFolder(name);
}

function folder_() { return sub_(PDF_FOLDER); }
function docFolder_() { return sub_(DOC_FOLDER); }

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
  folder_();
  docFolder_();
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
