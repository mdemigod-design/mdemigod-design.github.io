/**
 * Director CMS - Google Drive bridge
 * Deploy as Web App: Execute as Me; access: Anyone.
 * Security: every request must include a Supabase user access token.
 * The token is verified against Supabase Auth and public.admin_users before Drive access.
 */
const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://njcyivxrtfxrppfyodip.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_GTSSfZ2LNDKiVSU-JLSegw_XbGiHMEE',
  DRIVE_ROOT_FOLDER_ID: '1oPzOtN1TcRyJOTzDj7ET1QAp1mdoK-rp',
  MAX_FILE_BYTES: 25 * 1024 * 1024
});

const FOLDERS = Object.freeze({
  activity: '01 ภาพกิจกรรม',
  site: '02 ภาพประกอบเว็บไซต์',
  documents: '03 เอกสารเผยแพร่',
  private: '04 เอกสารส่วนตัวและสำรอง',
  'best-practice': '05 best-practice'
});

function doPost(e) {
  try {
    const input = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const user = verifyAdmin_(input.accessToken);
    if (!user) return json_({ ok: false, error: 'ไม่มีสิทธิ์ผู้ดูแลระบบ' });

    if (input.action === 'upload') return upload_(input, user);
    if (input.action === 'set-public') return setPublic_(input);
    if (input.action === 'trash') return trash_(input);
    return json_({ ok: false, error: 'ไม่รู้จักคำสั่งที่ร้องขอ' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function verifyAdmin_(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const headers = {
    apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + accessToken
  };
  const auth = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/auth/v1/user', {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (auth.getResponseCode() !== 200) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const user = JSON.parse(auth.getContentText());
  const query = CONFIG.SUPABASE_URL + '/rest/v1/admin_users?user_id=eq.' +
    encodeURIComponent(user.id) + '&is_active=eq.true&select=user_id&limit=1';
  const check = UrlFetchApp.fetch(query, {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (check.getResponseCode() !== 200 || JSON.parse(check.getContentText()).length !== 1) {
    throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');
  }
  return user;
}

function upload_(input, user) {
  const folderKey = String(input.folder || '');
  if (!Object.prototype.hasOwnProperty.call(FOLDERS, folderKey)) throw new Error('หมวดจัดเก็บไม่ถูกต้อง');
  const encoded = String(input.base64 || '');
  if (!encoded) throw new Error('ไม่พบข้อมูลไฟล์');
  const bytes = Utilities.base64Decode(encoded);
  if (bytes.length > CONFIG.MAX_FILE_BYTES) throw new Error('ไฟล์มีขนาดเกิน 25 MB');
  const mime = String(input.mimeType || 'application/octet-stream');
  if (!/^(image\/(jpeg|png|gif|webp)|application\/pdf|application\/vnd\..+|application\/msword|text\/plain)$/.test(mime)) {
    throw new Error('ไม่รองรับชนิดไฟล์นี้');
  }
  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const folder = getOrCreateFolder_(root, FOLDERS[folderKey]);
  const name = safeName_(input.fileName || 'upload');
  const blob = Utilities.newBlob(bytes, mime, name);
  const file = folder.createFile(blob);
  file.setDescription('Uploaded by Director CMS for admin user ' + user.id);
  const makePublic = input.publish === true && folderKey !== 'private';
  if (makePublic) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json_({
    ok: true, fileId: file.getId(), fileName: file.getName(), mimeType: file.getMimeType(),
    viewUrl: file.getUrl(),
    publicUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    isPublic: makePublic, folder: FOLDERS[folderKey]
  });
}

function setPublic_(input) {
  const file = DriveApp.getFileById(String(input.fileId || ''));
  const managed = isManagedFile_(file);
  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  if (input.publish === true) {
    const folderKey = String(input.folder || '');
    if (!['activity', 'site', 'documents', 'best-practice'].includes(folderKey)) throw new Error('หมวดเผยแพร่ไม่ถูกต้อง');
    if (managed) file.moveTo(getOrCreateFolder_(root, FOLDERS[folderKey]));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (managed) file.moveTo(getOrCreateFolder_(root, FOLDERS.private));
  }
  return json_({ ok: true, fileId: file.getId(), isPublic: input.publish === true, viewUrl: file.getUrl(),
    publicUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId() });
}

function trash_(input) {
  const file = DriveApp.getFileById(String(input.fileId || ''));
  if (!isManagedFile_(file)) throw new Error('ไฟล์นี้ไม่ได้อยู่ในโฟลเดอร์ที่ CMS จัดการ');
  file.setTrashed(true);
  return json_({ ok: true, fileId: file.getId(), trashed: true });
}

function isManagedFile_(file) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    const folder = parents.next();
    if (!Object.values(FOLDERS).includes(folder.getName())) continue;
    const ancestors = folder.getParents();
    while (ancestors.hasNext()) {
      if (ancestors.next().getId() === CONFIG.DRIVE_ROOT_FOLDER_ID) return true;
    }
  }
  return false;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  const folder = folders.hasNext() ? folders.next() : parent.createFolder(name);
  // The Best Practice folder is intentionally discoverable by the public.
  if (name === FOLDERS['best-practice']) {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return folder;
}

function safeName_(name) {
  return String(name).replace(/[\\/:*?"<>|#%{}~&]/g, '_').slice(0, 180) || 'upload';
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
