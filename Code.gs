/**
 * ARSIP SURAT KSPKT POLSEK JATIROGO
 * Semua data disimpan LANGSUNG di folder Google Drive berikut:
 *   - Database  : file Google Sheets "Arsip KSPKT Jatirogo (Database)" (dibuat otomatis)
 *   - PDF surat : subfolder "PDF Surat" (dibuat otomatis)
 *
 * LANGKAH: simpan (Ctrl+S), lalu jalankan fungsi "setup" sekali
 * (pilih "setup" di menu atas, klik Jalankan, lalu izinkan akses).
 */
var TOKEN = 'jatirogo2026';
var FOLDER_ID = '14NzbERuRjDaHzmUKoCEk1tEEAyJJ_2K3';
var DB_NAME = 'Arsip KSPKT Jatirogo (Database)';
var SHEET_NAME = 'Arsip';
var PDF_FOLDER = 'PDF Surat';
var HEAD = ['id', 'Nomor Surat', 'Tanggal', 'Pelapor', 'Barang / Surat', 'Petugas', 'Dicetak', 'PDF', 'Link PDF', 'Disimpan', 'Data (JSON)'];

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

function folder_() {
  var r = root_();
  var it = r.getFoldersByName(PDF_FOLDER);
  return it.hasNext() ? it.next() : r.createFolder(PDF_FOLDER);
}

// Jalankan SEKALI untuk memberi izin dan membuat database + folder PDF
function setup() {
  sheet_();
  folder_();
  Logger.log('Siap. Database dan folder PDF sudah dibuat di folder Drive.');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Mengambil seluruh arsip
function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out_({ error: 'Kode rahasia salah' });
  var rows = sheet_().getDataRange().getValues();
  var recs = [];
  for (var i = 1; i < rows.length; i++) {
    try { recs.push(JSON.parse(rows[i][10])); } catch (x) {}
  }
  return out_({ records: recs });
}

// Menyimpan / menghapus surat dan mengunggah PDF
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ error: 'Data tidak valid' }); }
  if (b.token !== TOKEN) return out_({ error: 'Kode rahasia salah' });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheet_();
    var id = b.action === 'save' ? (b.record && b.record.id) : b.id;
    var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
    var row = id ? ids.indexOf(id) + 1 : 0;

    if (b.action === 'save') {
      var r = b.record;
      var vals = [r.id, r.no, r.waktu, r.nama, r.barang, r.petugas,
        r.cetak ? 'Ya' : 'Belum', r.pdf ? 'Ya' : 'Belum', r.pdfUrl || '',
        new Date(r.saved || Date.now()), JSON.stringify(r)];
      if (row > 1) sh.getRange(row, 1, 1, vals.length).setValues([vals]);
      else sh.appendRow(vals);
      return out_({ ok: true });
    }

    if (b.action === 'delete') {
      if (row > 1) sh.deleteRow(row);
      return out_({ ok: true });
    }

    if (b.action === 'pdf') {
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
