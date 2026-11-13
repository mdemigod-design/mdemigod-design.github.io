import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RichTextEditor, RichTextContent } from './RichTextEditor';
import { uploadDriveFile, setDriveFilePublic } from '../lib/driveMedia';

const emptyForm = {
  id: null, title: '', summary: '', content: '', image_url: '', alt_text: '',
  activity_date: '', drive_file_id: '', sort_order: 0, status: 'draft'
};

const configs = {
  'agreements-standard': {
    table: 'performance_agreements', type: 'standard_position',
    title: 'ส่วนที่ 1 ข้อตกลงในการพัฒนางานตามมาตรฐานตำแหน่ง',
    heading: 'เพิ่มข้อตกลงตามมาตรฐานตำแหน่ง'
  },
  'agreements-challenge': {
    table: 'performance_agreements', type: 'challenging_issue',
    title: 'ส่วนที่ 2 ประเด็นท้าทายในการพัฒนาผลลัพธ์การเรียนรู้ของผู้เรียน',
    heading: 'เพิ่มประเด็นท้าทาย'
  },
  'management-models': {
    table: 'management_models', title: 'รูปแบบการบริหารงาน',
    heading: 'เพิ่มรูปแบบการบริหารงาน'
  },
  'activity-gallery': {
    table: 'activity_gallery', title: 'ภาพกิจกรรมต่าง ๆ',
    heading: 'เพิ่มภาพกิจกรรม'
  }
};

export function AdditionalAdmin({ tab }) {
  const config = configs[tab];
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState(null);

  async function load() {
    if (!config || !supabase) return;
    let query = supabase.from(config.table).select('*').order('sort_order').order('created_at', { ascending: false });
    if (config.type) query = query.eq('section_type', config.type);
    const { data, error } = await query;
    if (error) setMessage(error.message);
    else setRows(data || []);
  }

  useEffect(() => {
    setForm(emptyForm);
    setSelectedFile(null);
    setSelectedPdfFile(null);
    setMessage('');
    load();
  }, [tab]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return setMessage('กรุณากรอกชื่อเรื่อง');
    if (tab === 'activity-gallery' && !form.image_url.trim() && !selectedFile) return setMessage('กรุณาเลือกภาพกิจกรรมหรือระบุ URL ภาพ');
    setBusy(true);
    setMessage('');
    try {
    const folder = tab === 'activity-gallery' ? 'activity' : 'site';
    let driveMeta = null;
    let pdfMeta = null;
    if (selectedFile) {
      driveMeta = await uploadDriveFile(selectedFile, 'private', false);
    }
    if (selectedPdfFile) {
      if (selectedPdfFile.type !== 'application/pdf' && !selectedPdfFile.name.toLowerCase().endsWith('.pdf')) throw new Error('กรุณาเลือกไฟล์ PDF เท่านั้น');
      pdfMeta = await uploadDriveFile(selectedPdfFile, 'private', false);
    }
    const payload = {
      title: form.title.trim(),
      summary: form.summary || '',
      content: { text: form.content || '' },
      sort_order: Number(form.sort_order) || 0,
      status: form.status,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    if (config.type) payload.section_type = config.type;
    if (driveMeta) payload.drive_file_id = driveMeta.fileId;
    if (config.type && pdfMeta) payload.drive_file_id = pdfMeta.fileId;
    if (tab === 'management-models') payload.image_url = driveMeta?.publicUrl || form.image_url || '';
    if (tab === 'activity-gallery') {
      payload.description = form.summary || '';
      payload.image_url = driveMeta?.publicUrl || form.image_url.trim();
      payload.alt_text = form.alt_text || form.title;
      payload.activity_date = form.activity_date || null;
      delete payload.summary;
      delete payload.content;
    }
    const result = form.id
      ? await supabase.from(config.table).update(payload).eq('id', form.id)
      : await supabase.from(config.table).insert(payload);
    if (result.error) setMessage('บันทึกไม่สำเร็จ: ' + result.error.message);
    else {
      try {
        const targetFileId = pdfMeta?.fileId || driveMeta?.fileId || form.drive_file_id;
        if (targetFileId) await setDriveFilePublic(targetFileId, form.status === 'published', folder);
        if ((driveMeta || pdfMeta) && form.drive_file_id) await setDriveFilePublic(form.drive_file_id, false, folder);
        setMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
      } catch (permissionError) {
        setMessage('บันทึกข้อมูลแล้ว แต่ปรับสิทธิ์ไฟล์ไม่สำเร็จ: ' + permissionError.message);
      }
      setForm(emptyForm);
      setSelectedFile(null);
      setSelectedPdfFile(null);
      await load();
    }
    } catch (error) {
      setMessage('ดำเนินการกับ Google Drive ไม่สำเร็จ: ' + error.message);
    }
    setBusy(false);
  }

  async function edit(row) {
    setSelectedFile(null);
    setSelectedPdfFile(null);
    setForm({
      ...emptyForm, ...row,
      summary: row.summary || row.description || '',
      content: row.content?.text || '',
      activity_date: row.activity_date || '',
      image_url: row.image_url || '', drive_file_id: row.drive_file_id || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(row) {
    if (!window.confirm('ยืนยันลบรายการ "' + row.title + '" หรือไม่?')) return;
    try {
      if (row.drive_file_id) await setDriveFilePublic(row.drive_file_id, false, tab === 'activity-gallery' ? 'activity' : 'site');
      const { error } = await supabase.from(config.table).delete().eq('id', row.id);
      if (error) throw error;
      setMessage('ลบรายการแล้ว');
      await load();
    } catch (error) {
      setMessage('ลบไม่สำเร็จ: ' + error.message);
    }
  }

  if (!config) return null;
  return <section className="additional-admin">
    <div className="admin-columns">
      <form className="editor-card" onSubmit={submit}>
        <h2>{form.id ? 'แก้ไขข้อมูล' : config.heading}</h2>
        <label>ชื่อเรื่อง<input value={form.title} onChange={e => update('title', e.target.value)} required /></label>
        {tab !== 'activity-gallery' && <label>คำอธิบายโดยย่อ<textarea rows="3" value={form.summary} onChange={e => update('summary', e.target.value)} /></label>}
        {config.type && <div className="agreement-pdf-upload"><label>แนบเอกสาร PDF (ไม่เกิน 25 MB)<input type="file" accept="application/pdf,.pdf" onChange={e => setSelectedPdfFile(e.target.files?.[0] || null)} /></label>{selectedPdfFile && <p className="helper-text">ไฟล์ PDF ที่เลือก: {selectedPdfFile.name}</p>}{form.drive_file_id && !selectedPdfFile && <p className="helper-text">มีไฟล์ PDF แนบอยู่แล้ว <a href={`https://drive.google.com/file/d/${form.drive_file_id}/view`} target="_blank" rel="noreferrer">เปิดดูไฟล์เดิม</a></p>}</div>}
        {tab === 'management-models' && <><label>เลือกภาพจากเครื่องเพื่ออัปโหลดไป Google Drive (ไม่เกิน 25 MB)<input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} /></label><label>หรือ URL ภาพประกอบเดิม<input type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://..." /></label></>}
        {tab === 'activity-gallery' && <>
          <label>อัปโหลดภาพกิจกรรมจากเครื่อง (ไม่เกิน 25 MB)<input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} /></label><label>หรือ URL ภาพกิจกรรม<input type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://..." /></label>
          <label>ข้อความทดแทนภาพ<input value={form.alt_text} onChange={e => update('alt_text', e.target.value)} placeholder="คำอธิบายภาพ" /></label>
          <label>วันที่จัดกิจกรรม<input type="date" value={form.activity_date} onChange={e => update('activity_date', e.target.value)} /></label>
          <label>คำบรรยายภาพ<textarea rows="3" value={form.summary} onChange={e => update('summary', e.target.value)} /></label>
          {form.image_url && <img className="gallery-preview" src={form.image_url} alt={form.alt_text || 'ตัวอย่างภาพ'} />}
        </>}
        {tab !== 'activity-gallery' && <label>เนื้อหาเต็ม<RichTextEditor label="เนื้อหา" value={form.content} onChange={value => update('content', value)} /></label>}
        <label>ลำดับการแสดง<input type="number" value={form.sort_order} onChange={e => update('sort_order', e.target.value)} /></label>
        <label>สถานะ<select value={form.status} onChange={e => update('status', e.target.value)}><option value="draft">ฉบับร่าง</option><option value="published">เผยแพร่</option><option value="archived">เก็บถาวร</option></select></label>
        {message && <p className="additional-message">{message}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'กำลังบันทึก…' : form.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</button>
        {form.id && <button type="button" className="secondary-button additional-cancel" onClick={() => { setForm(emptyForm); setSelectedFile(null); setSelectedPdfFile(null); }}>ยกเลิกการแก้ไข</button>}
      </form>
      <section className="record-card">
        <h2>รายการทั้งหมด <span>{rows.length}</span></h2>
        {rows.length ? rows.map(row => <article className="record-row" key={row.id}>
          <div className="additional-record">
            {row.image_url && <img src={row.image_url} alt={row.alt_text || row.title} />}
            <div><b>{row.title}</b><small>{row.status === 'published' ? 'เผยแพร่' : row.status === 'archived' ? 'เก็บถาวร' : 'ฉบับร่าง'}</small></div>
          </div>
          <div className="record-actions"><button type="button" onClick={() => edit(row)}>แก้ไข</button><button type="button" className="delete-button" onClick={() => remove(row)}>ลบ</button></div>
        </article>) : <p className="empty-state">ยังไม่มีรายการ</p>}
      </section>
    </div>
  </section>;
}

export function AdditionalPublicContent() {
  const [agreements, setAgreements] = useState([]);
  const [models, setModels] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('performance_agreements').select('*').eq('status', 'published').order('section_type').order('sort_order'),
      supabase.from('management_models').select('*').eq('status', 'published').order('sort_order'),
      supabase.from('activity_gallery').select('*').eq('status', 'published').order('activity_date', { ascending: false }).order('sort_order')
    ]).then(([a, m, p]) => {
      setAgreements(a.data || []);
      setModels(m.data || []);
      setPhotos(p.data || []);
    });
  }, []);

  const standard = agreements.filter(item => item.section_type === 'standard_position');
  const challenge = agreements.filter(item => item.section_type === 'challenging_issue');
  const renderAgreements = (items, heading, id) => items.length > 0 && <section className="section-wrap additional-section" id={id}>
    <div className="section-heading"><div><div className="section-kicker">PERFORMANCE AGREEMENT</div><h2>{heading}</h2></div></div>
    <div className="additional-content-grid">{items.map(item => <article className="additional-content-card" key={item.id}>
      <h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}
      <RichTextContent className="rich-text-view" html={item.content?.text || ''} />
      {item.drive_file_id && <div className="agreement-pdf-link"><a href={`https://drive.google.com/file/d/${item.drive_file_id}/view`} target="_blank" rel="noreferrer">📄 เปิดเอกสาร PDF แนบ</a><a href={`https://drive.google.com/uc?export=download&id=${item.drive_file_id}`} target="_blank" rel="noreferrer">ดาวน์โหลด PDF</a></div>}
    </article>)}</div>
  </section>;

  return <>
    {renderAgreements(standard, 'ส่วนที่ 1 ข้อตกลงในการพัฒนางานตามมาตรฐานตำแหน่ง', 'agreements-standard')}
    {renderAgreements(challenge, 'ส่วนที่ 2 ประเด็นท้าทายในการพัฒนาผลลัพธ์การเรียนรู้ของผู้เรียน', 'agreements-challenge')}
    {models.length > 0 && <section className="section-wrap additional-section" id="management-models">
      <div className="section-heading"><div><div className="section-kicker">MANAGEMENT FRAMEWORK</div><h2>รูปแบบการบริหารงาน</h2></div></div>
      <div className="additional-content-grid">{models.map(item => <article className="additional-content-card" key={item.id}>
        {item.image_url && <img className="model-image" src={item.image_url} alt={item.title} />}
        <h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}
        <RichTextContent className="rich-text-view" html={item.content?.text || ''} />
      </article>)}</div>
    </section>}
    {photos.length > 0 && <section className="section-wrap additional-section" id="activity-gallery">
      <div className="section-heading"><div><div className="section-kicker">SCHOOL GALLERY</div><h2>ภาพกิจกรรมต่าง ๆ</h2></div></div>
      <div className="activity-gallery-grid">{photos.map(photo => <figure className="activity-photo" key={photo.id}>
        <img src={photo.image_url} alt={photo.alt_text || photo.title} loading="lazy" />
        <figcaption><b>{photo.title}</b>{photo.description && <p>{photo.description}</p>}</figcaption>
      </figure>)}</div>
    </section>}
  </>;
}
