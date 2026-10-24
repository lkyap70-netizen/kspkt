/**
 * KSPKT POLSEK JATIROGO - GOOGLE APPS SCRIPT API
 * Kompatibel dengan index.html KSPKT yang memakai aksi:
 * save/delete/pdf/claimNo, userSave/userDelete/userlist,
 * ohSave/ohDelete/ohlist, smSave/smDelete/smlist, smUpload/smTrash.
 *
 * LANGKAH AWAL:
 * 1. Jika project ini sudah terhubung ke Spreadsheet lama, biarkan SPREADSHEET_ID kosong.
 * 2. Jika project berdiri sendiri dan database lama ada di Spreadsheet tertentu,
 *    isi SPREADSHEET_ID dengan ID Spreadsheet tersebut sebelum menjalankan setup().
 * 3. Jalankan setup() satu kali dari editor Apps Script.
 * 4. Buka Execution log untuk melihat URL Spreadsheet dan TOKEN API.
 * 5. Deploy > Manage deployments > Edit > New version > Deploy.
 * 6. Masukkan URL /exec dan TOKEN yang sama pada menu Database di aplikasi.
 *
 * Catatan keamanan: file di Drive tetap privat mengikuti izin akun pemilik.
 * Jangan aktifkan sharing publik untuk data laporan/identitas.
 */

var KSPKT_CONFIG = {
  // Kosongkan untuk mempertahankan token lama dari Script Properties.
  // Untuk project baru boleh isi token rahasia sendiri, lalu jalankan setup().
  API_TOKEN: '',

  // Jika ingin memakai Spreadsheet tertentu, isi ID-nya di sini.
  // ID adalah bagian di antara /d/ dan /edit pada URL Spreadsheet.
  SPREADSHEET_ID: '',

  // Opsional: ID folder induk Google Drive yang sudah ada.
  // Kosongkan untuk memakai folder KSPKT Polsek Jatirogo yang dibuat otomatis.
  DRIVE_FOLDER_ID: ''
};

var KSPKT_VERSION = '2026.10.24-2';
var KSPKT_PROP = PropertiesService.getScriptProperties();

var KSPKT_COLLECTIONS = {
  records: {
    preferred: 'Records',
    aliases: ['Records', 'Arsip', 'Arsip Surat', 'Data', 'KSPKT_Arsip', 'Database']
  },
  users: {
    preferred: 'Users',
    aliases: ['Users', 'Petugas', 'Pengguna', 'Akun', 'KSPKT_Petugas']
  },
  oh: {
    preferred: 'Orang_Hilang',
    aliases: ['Orang_Hilang', 'Orang Hilang', 'Laporan_Orang_Hilang', 'KSPKT_Orang_Hilang']
  },
  sm: {
    preferred: 'Surat_Masuk',
    aliases: ['Surat_Masuk', 'Surat Masuk', 'Agenda_Surat_Masuk', 'KSPKT_Surat_Masuk']
  },
  claims: {
    preferred: 'Nomor',
    aliases: ['Nomor', 'Klaim_Nomor', 'KSPKT_Nomor']
  }
};

/** Jalankan manual satu kali setelah Code.gs ditempel. Tidak menghapus tab lama. */
function setup() {
  var ss = resolveSpreadsheetForSetup_();
  KSPKT_PROP.setProperty('KSPKT_SPREADSHEET_ID', ss.getId());
  var token = getToken_();
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    KSPKT_PROP.setProperty('KSPKT_API_TOKEN', token);
  } else {
    KSPKT_PROP.setProperty('KSPKT_API_TOKEN', token);
  }

  ensureCollectionSheet_(ss, 'records');
  ensureCollectionSheet_(ss, 'users');
  ensureCollectionSheet_(ss, 'oh');
  ensureCollectionSheet_(ss, 'sm');
  ensureCollectionSheet_(ss, 'claims');
  ensureDriveFolders_();

  Logger.log('KSPKT setup selesai.');
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('API TOKEN (samakan dengan menu Database aplikasi): ' + token);
  Logger.log('Versi backend: ' + KSPKT_VERSION);
  return { ok: true, spreadsheetUrl: ss.getUrl(), version: KSPKT_VERSION };
}

/** GET: mengembalikan arsip utama atau daftar khusus sesuai action. */
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    requireToken_(p.token);
    var action = String(p.action || '').trim().toLowerCase();
    if (action === 'userlist') return jsonOut_({ ok: true, version: KSPKT_VERSION, users: readCollection_('users') });
    if (action === 'ohlist') return jsonOut_({ ok: true, version: KSPKT_VERSION, oh: readCollection_('oh') });
    if (action === 'smlist') return jsonOut_({ ok: true, version: KSPKT_VERSION, sm: readCollection_('sm') });
    if (action === 'news') return jsonOut_(getNews_());
    if (action === 'ping' || action === 'status') {
      return jsonOut_({ ok: true, version: KSPKT_VERSION, message: 'KSPKT Apps Script aktif.' });
    }
    if (!action) return jsonOut_({ ok: true, version: KSPKT_VERSION, records: readCollection_('records') });
    return jsonOut_({ error: 'Aksi GET tidak dikenal: ' + action, version: KSPKT_VERSION });
  } catch (err) {
    return jsonOut_({ error: safeMessage_(err), version: KSPKT_VERSION });
  }
}

/** POST: simpan/hapus data, klaim nomor, dan penanganan berkas Drive. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Isi permintaan kosong.');
    var body = JSON.parse(e.postData.contents);
    requireToken_(body.token);
    var action = String(body.action || '').trim();
    var result;

    switch (action) {
      case 'save':
        result = saveRecord_('records', body.record);
        break;
      case 'delete':
        result = deleteRecord_('records', body.id);
        break;
      case 'userSave':
        result = saveRecord_('users', body.record);
        break;
      case 'userDelete':
        result = deleteRecord_('users', body.id);
        break;
      case 'ohSave':
        result = saveRecord_('oh', body.record);
        break;
      case 'ohDelete':
        result = deleteRecord_('oh', body.id);
        break;
      case 'smSave':
        result = saveRecord_('sm', body.record);
        break;
      case 'smDelete':
        result = deleteRecord_('sm', body.id);
        break;
      case 'claimNo':
        result = claimNo_(body.year, body.urut, body.by);
        break;
      case 'pdf':
        result = uploadPdf_(body);
        break;
      case 'smUpload':
        result = uploadSuratMasuk_(body);
        break;
      case 'smTrash':
        result = trashDriveFile_(body.fileId);
        break;
      default:
        throw new Error('Aksi tidak dikenal: ' + action);
    }
    result = result || { ok: true };
    result.ok = true;
    result.version = KSPKT_VERSION;
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({ error: safeMessage_(err), version: KSPKT_VERSION });
  }
}

/* ========================= TOKEN DAN DATABASE ========================= */
function getToken_() {
  var configured = String(KSPKT_CONFIG.API_TOKEN || '').trim();
  var saved = KSPKT_PROP.getProperty('KSPKT_API_TOKEN') ||
              KSPKT_PROP.getProperty('API_TOKEN') ||
              KSPKT_PROP.getProperty('TOKEN') ||
              KSPKT_PROP.getProperty('APIKEY') || '';
  return String(configured || saved || '').trim();
}

function requireToken_(provided) {
  var expected = getToken_();
  if (!expected) throw new Error('Token belum disiapkan. Jalankan setup() dari editor Apps Script.');
  if (!provided || String(provided) !== expected) throw new Error('Token tidak sesuai. Samakan token pada menu Database dengan token Apps Script.');
}

function resolveSpreadsheetForSetup_() {
  var configured = String(KSPKT_CONFIG.SPREADSHEET_ID || '').trim();
  if (configured) return SpreadsheetApp.openById(configured);

  // Prioritaskan ID yang sudah tersimpan agar setup tidak membuat database baru.
  var existingId = KSPKT_PROP.getProperty('KSPKT_SPREADSHEET_ID') ||
                   KSPKT_PROP.getProperty('SPREADSHEET_ID') ||
                   KSPKT_PROP.getProperty('DATABASE_SPREADSHEET_ID') ||
                   KSPKT_PROP.getProperty('DB_ID') ||
                   KSPKT_PROP.getProperty('SHEET_ID') || '';
  if (existingId) {
    try { return SpreadsheetApp.openById(existingId); } catch (err) {
      throw new Error('ID Spreadsheet tersimpan tidak dapat dibuka. Periksa izin akses atau isi KSPKT_CONFIG.SPREADSHEET_ID.');
    }
  }

  // Jika project terikat langsung ke spreadsheet, gunakan spreadsheet aktif.
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (ignore) {}

  return SpreadsheetApp.create('Database KSPKT Polsek Jatirogo');
}

function getSpreadsheet_() {
  var configured = String(KSPKT_CONFIG.SPREADSHEET_ID || '').trim();
  var id = configured || KSPKT_PROP.getProperty('KSPKT_SPREADSHEET_ID') ||
           KSPKT_PROP.getProperty('SPREADSHEET_ID') ||
           KSPKT_PROP.getProperty('DATABASE_SPREADSHEET_ID') ||
           KSPKT_PROP.getProperty('DB_ID') || KSPKT_PROP.getProperty('SHEET_ID') || '';
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Database Spreadsheet belum disiapkan. Jalankan setup() terlebih dahulu.');
}

function aliasesFor_(key) {
  return KSPKT_COLLECTIONS[key].aliases || [KSPKT_COLLECTIONS[key].preferred];
}

function ensureCollectionSheet_(ss, key) {
  var conf = KSPKT_COLLECTIONS[key];
  var aliases = aliasesFor_(key);
  var chosen = null;

  // Utamakan tab lama yang sudah berisi data dengan kolom id + JSON.
  for (var i = 0; i < aliases.length; i++) {
    var existing = ss.getSheetByName(aliases[i]);
    if (existing && getSchema_(existing, false)) { chosen = existing; break; }
  }
  // Jika belum ada format yang cocok, pakai tab kosong yang namanya dikenal.
  if (!chosen) {
    for (var j = 0; j < aliases.length; j++) {
      var blankCandidate = ss.getSheetByName(aliases[j]);
      if (blankCandidate && isEmptySheet_(blankCandidate)) { chosen = blankCandidate; break; }
    }
  }

  if (!chosen) {
    var preferred = conf.preferred;
    var sheet = ss.getSheetByName(preferred);
    if (sheet && getSchema_(sheet, false)) chosen = sheet;
    else if (!sheet) chosen = ss.insertSheet(preferred);
    else {
      // Jangan menimpa tab lama yang formatnya berbeda.
      var safeName = 'KSPKT_' + preferred + '_JSON';
      var n = 2;
      while (ss.getSheetByName(safeName)) { safeName = 'KSPKT_' + preferred + '_JSON_' + n; n++; }
      chosen = ss.insertSheet(safeName);
    }
  }

  var schema = getSchema_(chosen, false);
  if (!schema) {
    if (isEmptySheet_(chosen)) {
      chosen.getRange(1, 1, 1, 3).setValues([['id', 'saved', 'json']]);
      chosen.setFrozenRows(1);
      chosen.getRange(1, 1, 1, 3).setFontWeight('bold');
    } else {
      // Tab berisi data yang belum kompatibel: jangan ubah isinya.
      throw new Error('Tab ' + chosen.getName() + ' berisi data dengan format berbeda. Tab lama tidak diubah.');
    }
  } else {
    // Tambahkan kolom yang kurang tanpa menghapus kolom/tab lama.
    ensureHeader_(chosen, 'id');
    ensureHeader_(chosen, 'saved');
    ensureHeader_(chosen, 'json');
  }
  return chosen;
}

function isEmptySheet_(sheet) {
  return sheet.getLastRow() === 0 || (sheet.getLastRow() === 1 && sheet.getLastColumn() === 1 && String(sheet.getRange(1, 1).getValue() || '') === '');
}

function normHeader_(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function getSchema_(sheet, ensure) {
  if (!sheet || sheet.getLastRow() < 1) return null;
  var hdr = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0];
  var map = {};
  for (var i = 0; i < hdr.length; i++) {
    var h = normHeader_(hdr[i]);
    if (['id', 'recordid', 'key'].indexOf(h) >= 0) map.id = i + 1;
    if (['saved', 'updated', 'updatedat', 'timestamp', 'waktuupdate'].indexOf(h) >= 0) map.saved = i + 1;
    if (['json', 'datajson', 'recordjson', 'payload', 'record', 'data'].indexOf(h) >= 0) map.json = i + 1;
  }
  if (map.id && map.json) return map;
  // Mendeteksi tab lama tanpa header JSON hanya jika ID dan JSON berada di kolom berbeda.
  if (sheet.getLastRow() >= 2) {
    var rows = sheet.getRange(2, 1, Math.min(sheet.getLastRow() - 1, 5), sheet.getLastColumn()).getValues();
    for (var r = 0; r < rows.length; r++) {
      for (var c = 0; c < rows[r].length; c++) {
        if (typeof rows[r][c] === 'string' && String(rows[r][c]).trim().charAt(0) === '{') {
          try {
            var obj = JSON.parse(rows[r][c]);
            if (obj && obj.id !== undefined) {
              var idCol = map.id || 0;
              if (!idCol) {
                for (var c2 = 0; c2 < rows[r].length; c2++) {
                  if (c2 !== c && String(rows[r][c2]) === String(obj.id)) { idCol = c2 + 1; break; }
                }
              }
              if (idCol && idCol !== c + 1) return { id: idCol, saved: map.saved || 0, json: c + 1, detected: true };
            }
          } catch (ignore) {}
        }
      }
    }
  }
  return null;
}

function ensureHeader_(sheet, header) {
  var schema = getSchema_(sheet, false) || {};
  if ((header === 'id' && schema.id) || (header === 'saved' && schema.saved) || (header === 'json' && schema.json)) return;
  var col = sheet.getLastColumn() + 1;
  if (sheet.getLastRow() === 0) col = 1;
  sheet.getRange(1, col).setValue(header);
}

function sheetFor_(key) {
  var ss = getSpreadsheet_();
  var conf = KSPKT_COLLECTIONS[key];
  var aliases = aliasesFor_(key);
  for (var i = 0; i < aliases.length; i++) {
    var s = ss.getSheetByName(aliases[i]);
    if (s && (getSchema_(s, false) || isEmptySheet_(s))) return ensureCollectionSheet_(ss, key);
  }
  var preferred = ss.getSheetByName(conf.preferred);
  if (preferred && (getSchema_(preferred, false) || isEmptySheet_(preferred))) return ensureCollectionSheet_(ss, key);
  // setup normally creates the sheet. If user skipped setup, create it safely now.
  return ensureCollectionSheet_(ss, key);
}

function schemaMap_(sheet) {
  var schema = getSchema_(sheet, false);
  if (!schema) throw new Error('Struktur database pada tab ' + sheet.getName() + ' belum sesuai. Jalankan setup() atau periksa kolom id, saved, json.');
  return schema;
}

function readCollection_(key) {
  var sheet = sheetFor_(key);
  var schema = schemaMap_(sheet);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  values.forEach(function (row) {
    var raw = row[schema.json - 1];
    if (raw === '' || raw === null || typeof raw === 'undefined') return;
    try {
      var obj = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      if (obj && typeof obj === 'object' && obj.id !== undefined) out.push(obj);
    } catch (ignore) {}
  });
  return out;
}

function saveRecord_(key, record) {
  if (!record || typeof record !== 'object') throw new Error('Data record tidak valid.');
  if (record.id === undefined || record.id === null || String(record.id) === '') throw new Error('ID record wajib ada.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return saveRecordUnlocked_(key, record);
  } finally {
    lock.releaseLock();
  }
}

// Versi internal tanpa mengambil Lock lagi; digunakan oleh claimNo_ yang sudah mengunci proses.
function saveRecordUnlocked_(key, record) {
  var sheet = sheetFor_(key);
  var schema = schemaMap_(sheet);
  var id = String(record.id);
  var last = sheet.getLastRow();
  var rowNum = 0;
  if (last >= 2) {
    var ids = sheet.getRange(2, schema.id, last - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) { if (String(ids[i][0]) === id) { rowNum = i + 2; break; } }
  }
  if (!rowNum) rowNum = Math.max(2, last + 1);
  if (!record.saved) record.saved = Date.now();
  var width = Math.max(sheet.getLastColumn(), schema.id, schema.saved, schema.json);
  var row = new Array(width).fill('');
  row[schema.id - 1] = id;
  row[schema.saved - 1] = Number(record.saved) || Date.now();
  row[schema.json - 1] = JSON.stringify(record);
  sheet.getRange(rowNum, 1, 1, width).setValues([row]);
  return { ok: true, id: id, saved: Number(record.saved) || Date.now() };
}

function deleteRecord_(key, id) {
  if (id === undefined || id === null || String(id) === '') throw new Error('ID untuk dihapus tidak valid.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheetFor_(key);
    var schema = schemaMap_(sheet);
    var last = sheet.getLastRow();
    if (last < 2) return { ok: true, deleted: false };
    var ids = sheet.getRange(2, schema.id, last - 1, 1).getDisplayValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(id)) sheet.deleteRow(i + 2);
    }
    return { ok: true, deleted: true, id: String(id) };
  } finally {
    lock.releaseLock();
  }
}

/* ========================= NOMOR SURAT ANTI-GANDA ========================= */
function claimNo_(year, wanted, by) {
  year = parseInt(year, 10);
  wanted = parseInt(wanted, 10);
  if (!year || !wanted || wanted < 1) throw new Error('Tahun atau nomor urut tidak valid.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var records = readCollection_('records');
    var claims = readCollection_('claims');
    var used = {};
    var maxNo = 0;
    records.forEach(function (r) {
      var dt = String(r.waktu || '');
      var y = parseInt(dt.slice(0, 4), 10);
      var n = parseInt(r.urut, 10) || 0;
      if (y === year && n > 0) { used[n] = true; maxNo = Math.max(maxNo, n); }
    });
    claims.forEach(function (c) {
      if (Number(c.year) === year && Number(c.urut) > 0) {
        used[Number(c.urut)] = true;
        maxNo = Math.max(maxNo, Number(c.urut));
      }
    });
    var assigned = wanted;
    if (used[assigned]) assigned = maxNo + 1;
    saveRecordUnlocked_('claims', {
      id: String(year) + '_' + String(assigned),
      year: year,
      urut: assigned,
      by: String(by || ''),
      saved: Date.now()
    });
    return { no: assigned, year: year };
  } finally {
    lock.releaseLock();
  }
}

/* ========================= GOOGLE DRIVE ========================= */
function ensureDriveFolders_() {
  var rootId = String(KSPKT_CONFIG.DRIVE_FOLDER_ID || '').trim() ||
               KSPKT_PROP.getProperty('KSPKT_DRIVE_FOLDER_ID') ||
               KSPKT_PROP.getProperty('DRIVE_FOLDER_ID') ||
               KSPKT_PROP.getProperty('FOLDER_ID') || '';
  var root;
  if (rootId) {
    try { root = DriveApp.getFolderById(rootId); }
    catch (err) { throw new Error('Folder Drive ID tidak dapat diakses. Periksa izin dan ID folder.'); }
  } else {
    root = DriveApp.createFolder('KSPKT Polsek Jatirogo');
    KSPKT_PROP.setProperty('KSPKT_DRIVE_FOLDER_ID', root.getId());
  }
  KSPKT_PROP.setProperty('KSPKT_DRIVE_FOLDER_ID', root.getId());
  getOrCreateChildFolder_(root, 'Arsip PDF Surat Kehilangan', 'KSPKT_PDF_FOLDER_ID');
  getOrCreateChildFolder_(root, 'Berkas Surat Masuk', 'KSPKT_SM_FOLDER_ID');
}

function getOrCreateChildFolder_(root, name, propName) {
  var savedId = KSPKT_PROP.getProperty(propName);
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (ignore) {}
  }
  var iter = root.getFoldersByName(name);
  var folder = iter.hasNext() ? iter.next() : root.createFolder(name);
  KSPKT_PROP.setProperty(propName, folder.getId());
  return folder;
}

function getDriveFolder_(kind) {
  var prop = kind === 'sm' ? 'KSPKT_SM_FOLDER_ID' : 'KSPKT_PDF_FOLDER_ID';
  var folderId = KSPKT_PROP.getProperty(prop);
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (ignore) {}
  }
  ensureDriveFolders_();
  folderId = KSPKT_PROP.getProperty(prop);
  return DriveApp.getFolderById(folderId);
}

function decodeBase64_(data) {
  var text = String(data || '').trim();
  if (!text) throw new Error('Data berkas kosong.');
  // Menoleransi data URI selain base64 mentah.
  var marker = text.indexOf('base64,');
  if (marker >= 0) text = text.slice(marker + 7);
  text = text.replace(/\s/g, '');
  try { return Utilities.base64Decode(text); }
  catch (err) { throw new Error('Data base64 berkas tidak valid.'); }
}

function safeFilename_(name, fallback) {
  var n = String(name || fallback || 'Berkas').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  if (!n) n = fallback || 'Berkas';
  return n.slice(0, 180);
}

function uploadPdf_(body) {
  var id = String(body.id || '').trim();
  if (!id) throw new Error('ID surat untuk PDF wajib ada.');
  var filename = safeFilename_(body.filename, 'Surat_KSPKT.pdf');
  if (!/\.pdf$/i.test(filename)) filename += '.pdf';
  var bytes = decodeBase64_(body.data);
  var blob = Utilities.newBlob(bytes, 'application/pdf', filename);
  var folder = getDriveFolder_('pdf');
  var file = folder.createFile(blob);
  file.setDescription('PDF surat KSPKT Polsek Jatirogo. Record ID: ' + id);
  var oldId = String(body.oldFileId || '').trim();
  if (oldId && oldId !== file.getId()) trashDriveFileQuietly_(oldId);
  return { ok: true, id: id, fileId: file.getId(), url: file.getUrl(), size: file.getSize(), name: file.getName() };
}

function uploadSuratMasuk_(body) {
  var name = safeFilename_(body.name, 'Berkas_Surat_Masuk');
  var type = String(body.type || 'application/octet-stream').trim();
  var bytes = decodeBase64_(body.data);
  var blob = Utilities.newBlob(bytes, type, name);
  var folder = getDriveFolder_('sm');
  var file = folder.createFile(blob);
  file.setDescription('Lampiran surat masuk KSPKT Polsek Jatirogo.');
  return { ok: true, fileId: file.getId(), url: file.getUrl(), size: file.getSize(), name: file.getName(), type: type };
}

function trashDriveFile_(fileId) {
  fileId = String(fileId || '').trim();
  if (!fileId) throw new Error('ID berkas Drive tidak ada.');
  var file = DriveApp.getFileById(fileId);
  file.setTrashed(true);
  return { ok: true, fileId: fileId, trashed: true };
}

function trashDriveFileQuietly_(fileId) {
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (ignore) {}
}

/* ========================= BERITA POLRESTA TUBAN ========================= */
// Pencarian berita dari Google News (RSS) untuk "Polresta Tuban" / "Polres Tuban".
// Hasil di-cache 5 menit supaya tidak membebani sumber dan tetap terasa selalu terbaru.
var KSPKT_NEWS_QUERY = '"Polresta Tuban" OR "Polres Tuban" when:14d';
var KSPKT_NEWS_CACHE_KEY = 'kspkt_news_v1';

function getNews_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(KSPKT_NEWS_CACHE_KEY);
  if (hit) return JSON.parse(hit);

  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(KSPKT_NEWS_QUERY) +
            '&hl=id&gl=ID&ceid=ID:id';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Sumber berita tidak dapat diakses (kode ' + res.getResponseCode() + ').');
  }

  var channel = XmlService.parse(res.getContentText()).getRootElement().getChild('channel');
  var nodes = channel ? channel.getChildren('item') : [];
  var items = [];
  for (var i = 0; i < nodes.length; i++) {
    var it = nodes[i];
    var title = it.getChildText('title') || '';
    var src = it.getChild('source');
    var media = src ? src.getText() : '';
    // Google News menambahkan " - Nama Media" di ujung judul; dibuang agar rapi.
    var tail = ' - ' + media;
    if (media && title.slice(-tail.length) === tail) title = title.slice(0, -tail.length);
    var link = it.getChildText('link') || '';
    if (title && link) {
      items.push({ title: title, link: link, pubDate: it.getChildText('pubDate') || '', source: media });
    }
  }
  items.sort(function (a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });

  var out = { ok: true, version: KSPKT_VERSION, updated: new Date().toISOString(), items: items.slice(0, 15) };
  cache.put(KSPKT_NEWS_CACHE_KEY, JSON.stringify(out), 300);
  return out;
}

/* ========================= UTILITAS ========================= */
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeMessage_(err) {
  if (!err) return 'Terjadi kesalahan yang tidak diketahui.';
  return String(err.message || err).slice(0, 500);
}
