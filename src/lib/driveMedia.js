import { supabase } from './supabaseClient';

async function invokeDrive(body) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const { data, error } = await supabase.functions.invoke('drive-media', {
    body,
    headers: { Authorization: `Bearer ${token}` }
  });
  if (error) throw new Error(error.message || 'เชื่อมต่อ Google Drive ไม่สำเร็จ');
  if (!data?.ok) throw new Error(data?.error || 'Google Drive ไม่สามารถดำเนินการได้');
  return data;
}

export async function uploadDriveFile(file, folder, publish = false) {
  if (!file) throw new Error('กรุณาเลือกไฟล์');
  if (file.size > 25 * 1024 * 1024) throw new Error('ไฟล์มีขนาดเกิน 25 MB');
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
  return invokeDrive({
    action: 'upload', folder, publish,
    fileName: file.name, mimeType: file.type || 'application/octet-stream', base64
  });
}

export async function setDriveFilePublic(fileId, publish, folder) {
  if (!fileId) return null;
  return invokeDrive({ action: 'set-public', fileId, publish, folder });
}

export async function trashDriveFile(fileId) {
  if (!fileId) return null;
  return invokeDrive({ action: 'trash', fileId });
}
