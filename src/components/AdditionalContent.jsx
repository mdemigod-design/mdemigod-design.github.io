import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RichTextEditor, RichTextContent } from './RichTextEditor';
import { uploadDriveFile, setDriveFilePublic } from '../lib/driveMedia';

const emptyForm = {
  id: null, title: '', summary: '', content: '', image_url: '', alt_text: '',
  activity_date: '', academic_year: '', drive_file_id: '', pdf_file_id: '', image_file_id: '', sort_order: 0, status: 'draft'
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
  'best-practice': { table: 'best_practices', title: 'ส่วนที่ 3 Best Practice', heading: 'เพิ่มผลงาน Best Practice' },
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
    const folder = tab === 'activity-gallery' ? 'activity' : tab === 'best-practice' ? 'best-practice' : 'site';
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
    if (tab === 'best-practice') {
      payload.academic_year = form.academic_year.trim();
      if (!payload.academic_year) throw new Error('กรุณาระบุปีการศึกษาหรือปีงบประมาณ');
      payload.details = { text: form.content || '' };
      payload.pdf_file_id = pdfMeta?.fileId || form.pdf_file_id || null;
      payload.image_file_id = driveMeta?.fileId || form.image_file_id || null;
      payload.image_url = driveMeta?.publicUrl || form.image_url || '';
      delete payload.summary;
      delete payload.content;
    }
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
        if (tab === 'best-practice') {
          const imageId = driveMeta?.fileId || form.image_file_id;
          const pdfId = pdfMeta?.fileId || form.pdf_file_id;
          if (imageId) await setDriveFilePublic(imageId, form.status === 'published', folder);
          if (pdfId) await setDriveFilePublic(pdfId, form.status === 'published', folder);
          if (driveMeta && form.image_file_id) await setDriveFilePublic(form.image_file_id, false, folder);
          if (pdfMeta && form.pdf_file_id) await setDriveFilePublic(form.pdf_file_id, false, folder);
        } else {
          if (targetFileId) await setDriveFilePublic(targetFileId, form.status === 'published', folder);
          if ((driveMeta || pdfMeta) && form.drive_file_id) await setDriveFilePublic(form.drive_file_id, false, folder);
        }
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
      academic_year: row.academic_year || '',
      content: row.details?.text || row.content?.text || '',
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
      if (tab === 'best-practice') {
        if (row.pdf_file_id) await setDriveFilePublic(row.pdf_file_id, false, 'best-practice');
        if (row.image_file_id) await setDriveFilePublic(row.image_file_id, false, 'best-practice');
      }
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
        {tab === 'best-practice' && <>
          <label>ปีการศึกษาหรือปีงบประมาณ<input value={form.academic_year} onChange={e => update('academic_year', e.target.value)} placeholder="เช่น ปีการศึกษา 2569 หรือ ปีงบประมาณ 2569" required /></label>
          <label>รายละเอียดผลงาน<RichTextEditor label="รายละเอียด Best Practice" value={form.content} onChange={value => update('content', value)} /></label>
          <div className="best-practice-upload"><label>ไฟล์เอกสาร PDF (ไม่เกิน 25 MB)<input type="file" accept="application/pdf,.pdf" onChange={e => setSelectedPdfFile(e.target.files?.[0] || null)} /></label>{selectedPdfFile && <small>เลือกแล้ว: {selectedPdfFile.name}</small>}{form.pdf_file_id && !selectedPdfFile && <p><a href={`https://drive.google.com/file/d/${form.pdf_file_id}/view`} target="_blank" rel="noreferrer">เปิด PDF เดิม</a></p>}</div>
          <div className="best-practice-upload"><label>ภาพประกอบ (ไม่เกิน 25 MB)<input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} /></label>{selectedFile && <small>เลือกแล้ว: {selectedFile.name}</small>}{form.image_url && <img className="gallery-preview" src={form.image_url} alt="ภาพประกอบ Best Practice" />}</div>
        </>}
        {tab === 'management-models' && <><label>เลือกภาพจากเครื่องเพื่ออัปโหลดไป Google Drive (ไม่เกิน 25 MB)<input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} /></label><label>หรือ URL ภาพประกอบเดิม<input type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://..." /></label></>}
        {tab === 'activity-gallery' && <>
          <label>อัปโหลดภาพกิจกรรมจากเครื่อง (ไม่เกิน 25 MB)<input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} /></label><label>หรือ URL ภาพกิจกรรม<input type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://..." /></label>
          <label>ข้อความทดแทนภาพ<input value={form.alt_text} onChange={e => update('alt_text', e.target.value)} placeholder="คำอธิบายภาพ" /></label>
          <label>วันที่จัดกิจกรรม<input type="date" value={form.activity_date} onChange={e => update('activity_date', e.target.value)} /></label>
          <label>คำบรรยายภาพ<textarea rows="3" value={form.summary} onChange={e => update('summary', e.target.value)} /></label>
          {form.image_url && <img className="gallery-preview" src={form.image_url} alt={form.alt_text || 'ตัวอย่างภาพ'} />}
        </>}
        {tab !== 'activity-gallery' && tab !== 'best-practice' && <label>เนื้อหาเต็ม<RichTextEditor label="เนื้อหา" value={form.content} onChange={value => update('content', value)} /></label>}
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
            <div><b>{row.title}</b>{tab === 'best-practice' && <small>{row.academic_year}</small>}<small>{row.status === 'published' ? 'เผยแพร่' : row.status === 'archived' ? 'เก็บถาวร' : 'ฉบับร่าง'}</small></div>
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
  const [bestPractices, setBestPractices] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase.from('performance_agreements').select('*').eq('status', 'published').order('section_type').order('sort_order'),
      supabase.from('management_models').select('*').eq('status', 'published').order('sort_order'),
      supabase.from('activity_gallery').select('*').eq('status', 'published').order('activity_date', { ascending: false }).order('sort_order'),
      supabase.from('best_practices').select('*').eq('status', 'published').not('published_at', 'is', null).order('academic_year', { ascending: false }).order('sort_order')
    ]).then(([a, m, p, b]) => {
      if (!active) return;
      setAgreements(a.data || []);
      setModels(m.data || []);
      setPhotos(p.data || []);
      setBestPractices(b.data || []);
    }).catch(error => console.error('Additional public content:', error));
    return () => { active = false; };
  }, []);

  // ตัวอย่างเนื้อหาเพื่อจัดวางหน้าเว็บระหว่างเตรียมข้อมูลจริง
  const demoStandard = [
    { id: 'demo-standard-1', is_demo: true, title: 'การพัฒนาคุณภาพการบริหารจัดการสถานศึกษา', summary: 'ข้อตกลงในการพัฒนางานตามมาตรฐานตำแหน่งผู้บริหารสถานศึกษา', content: { text: '<p>มุ่งพัฒนาระบบบริหารจัดการสถานศึกษาให้มีประสิทธิภาพ โปร่งใส และมุ่งผลลัพธ์ที่เกิดกับผู้เรียน ครู และชุมชน</p><h3>แนวทางการดำเนินงาน</h3><ul><li>พัฒนาระบบบริหารงานวิชาการและการประกันคุณภาพ</li><li>ส่งเสริมการจัดการเรียนรู้เชิงรุกและการใช้เทคโนโลยี</li><li>สร้างชุมชนแห่งการเรียนรู้ทางวิชาชีพ (PLC)</li></ul>' } }
  ];
  const demoChallenge = [
    { id: 'demo-challenge-1', is_demo: true, title: 'ยกระดับผลลัพธ์การเรียนรู้และสมรรถนะสำคัญของผู้เรียน', summary: 'ประเด็นท้าทายในการพัฒนาคุณภาพผู้เรียนอย่างเป็นระบบ', content: { text: '<p>พัฒนากระบวนการจัดการเรียนรู้ที่เน้นผู้เรียนเป็นสำคัญ เพื่อส่งเสริมทักษะการอ่าน การเขียน การคิดคำนวณ การคิดวิเคราะห์ และการแก้ปัญหาในชีวิตจริง</p><h3>ผลลัพธ์ที่มุ่งหวัง</h3><ul><li>ผู้เรียนมีพัฒนาการด้านการอ่านและการสื่อสาร</li><li>ผู้เรียนใช้เหตุผลและแก้ปัญหาได้เหมาะสมกับวัย</li><li>ครูมีเครื่องมือวัดและประเมินผลที่หลากหลาย</li></ul>' } }
  ];
  const demoBestPractices = [
    { id: 'demo-best-1', is_demo: true, academic_year: 'ตัวอย่าง ปีการศึกษา 2568', title: 'การพัฒนาการจัดการเรียนรู้เชิงรุกเพื่อเสริมสร้างสมรรถนะผู้เรียน', details: { text: '<p>ตัวอย่างผลงานนวัตกรรมการบริหารและการจัดการเรียนรู้ที่เชื่อมโยงบทเรียนกับสถานการณ์จริง เปิดโอกาสให้ผู้เรียนลงมือปฏิบัติ สะท้อนคิด และสร้างองค์ความรู้ด้วยตนเอง</p><h3>กระบวนการดำเนินงาน</h3><p>วิเคราะห์ปัญหาและความต้องการ → ออกแบบกิจกรรม → ทดลองใช้ → ประเมินผล → ปรับปรุงและขยายผล</p>' } }
  ];
  const demoModels = [
    { id: 'demo-model-1', is_demo: true, title: 'รูปแบบการบริหารงานแบบมีส่วนร่วมและมุ่งผลลัพธ์', summary: 'ตัวอย่างกรอบการบริหารที่เชื่อมโยงผู้บริหาร ครู ผู้เรียน ผู้ปกครอง และชุมชน', content: { text: '<p>ขับเคลื่อนสถานศึกษาด้วยการกำหนดเป้าหมายร่วม ใช้ข้อมูลสารสนเทศประกอบการตัดสินใจ และติดตามพัฒนาการอย่างต่อเนื่อง</p>' } }
  ];
  const demoPhotos = [
    { id: 'demo-photo-1', is_demo: true, title: 'การเรียนรู้เชิงรุกในห้องเรียน', description: 'ตัวอย่างพื้นที่สำหรับภาพกิจกรรมการจัดการเรียนรู้', art: 'learning', symbol: '✦' },
    { id: 'demo-photo-2', is_demo: true, title: 'กิจกรรมพัฒนาผู้เรียน', description: 'ตัวอย่างพื้นที่สำหรับภาพกิจกรรมของนักเรียน', art: 'students', symbol: '◎' },
    { id: 'demo-photo-3', is_demo: true, title: 'ความร่วมมือกับชุมชน', description: 'ตัวอย่างพื้นที่สำหรับภาพความร่วมมือของภาคีเครือข่าย', art: 'community', symbol: '⌂' }
  ];

  const standard = agreements.filter(item => item.section_type === 'standard_position');
  const challenge = agreements.filter(item => item.section_type === 'challenging_issue');
  const standardItems = standard.length ? standard : demoStandard;
  const challengeItems = challenge.length ? challenge : demoChallenge;
  const bestItems = bestPractices.length ? bestPractices : demoBestPractices;
  const modelItems = models.length ? models : demoModels;
  const photoItems = photos.length ? photos : demoPhotos;
  const renderAgreements = (items, heading, id, kicker) => <section className="section-wrap additional-section" id={id}>
    <div className="section-heading"><div><div className="section-kicker">{kicker}</div><h2>{heading}</h2></div><span className="section-note">LEADERSHIP & DEVELOPMENT</span></div>
    <div className="additional-content-grid">{items.map(item => <article className="additional-content-card" key={item.id}>
      {item.is_demo && <span className="demo-label">ตัวอย่างเนื้อหา DEMO</span>}
      <h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}
      <RichTextContent className="rich-text-view" html={item.content?.text || ''} />
      {item.drive_file_id && <div className="agreement-pdf-link"><a href={\`https://drive.google.com/file/d/\${item.drive_file_id}/view\`} target="_blank" rel="noreferrer">📄 เปิดเอกสาร PDF แนบ</a><a href={\`https://drive.google.com/uc?export=download&id=\${item.drive_file_id}\`} target="_blank" rel="noreferrer">ดาวน์โหลด PDF</a></div>}
    </article>)}</div>
  </section>;

  return <>
    <section className="portfolio-intro">
      <div className="portfolio-intro-inner">
        <div><span className="section-kicker">LEADERSHIP PORTFOLIO · 2026</span><h2>ผลงานและการขับเคลื่อน<br/><em>คุณภาพการศึกษา</em></h2><p>รวบรวมข้อตกลงในการพัฒนางาน ประเด็นท้าทาย นวัตกรรมการบริหาร และภาพกิจกรรม เพื่อสะท้อนแนวคิดและผลการดำเนินงานอย่างเป็นระบบ</p></div>
        <div className="portfolio-stamp"><b>5</b><span>CONTENT<br/>COLLECTIONS</span></div>
      </div>
      <nav className="portfolio-jump" aria-label="เมนูผลงาน">
        <a href="#agreements-standard"><span>01</span>ข้อตกลงมาตรฐานตำแหน่ง</a>
        <a href="#agreements-challenge"><span>02</span>ประเด็นท้าทาย</a>
        <a href="#best-practice"><span>03</span>Best Practice</a>
        <a href="#management-models"><span>04</span>รูปแบบการบริหารงาน</a>
        <a href="#activity-gallery"><span>05</span>ภาพกิจกรรม</a>
      </nav>
    </section>
    {renderAgreements(standardItems, 'ส่วนที่ 1 ข้อตกลงมาตรฐานตำแหน่ง', 'agreements-standard', 'PART 01 · PERFORMANCE AGREEMENT')}
    {renderAgreements(challengeItems, 'ส่วนที่ 2 ประเด็นท้าทาย', 'agreements-challenge', 'PART 02 · CHALLENGING ISSUES')}
    <section className="section-wrap additional-section best-practice-section" id="best-practice">
      <div className="section-heading"><div><div className="section-kicker">PART 03 · BEST PRACTICE</div><h2>ส่วนที่ 3 Best Practice</h2></div><span className="section-note">INNOVATION & GOOD PRACTICE</span></div>
      <div className="best-practice-grid">{bestItems.map(item => <article className="best-practice-feature" key={item.id}>
        <div className="best-practice-feature-copy">{item.is_demo && <span className="demo-label">ตัวอย่างเนื้อหา DEMO</span>}<span className="best-practice-year">{item.academic_year}</span><h3>{item.title}</h3><RichTextContent className="rich-text-view" html={item.details?.text || ''} />
          {item.pdf_file_id && <div className="best-practice-links"><a href={\`https://drive.google.com/file/d/\${item.pdf_file_id}/view\`} target="_blank" rel="noreferrer">📄 เปิดเอกสาร PDF</a><a href={\`https://drive.google.com/uc?export=download&id=\${item.pdf_file_id}\`} target="_blank" rel="noreferrer">ดาวน์โหลด PDF</a></div>}
        </div>
        <div className="best-practice-feature-art">{item.image_url ? <img src={item.image_url} alt={\`ภาพประกอบ \${item.title}\`} loading="lazy"/> : <div className="best-practice-monogram"><span>BEST</span><b>PRACTICE</b><small>LEARN · SHARE · GROW</small></div>}</div>
      </article>)}</div>
    </section>
    <section className="section-wrap additional-section management-section" id="management-models">
      <div className="section-heading"><div><div className="section-kicker">PART 04 · MANAGEMENT FRAMEWORK</div><h2>รูปแบบการบริหารงาน</h2></div><span className="section-note">VISION · PROCESS · OUTCOME</span></div>
      <div className="management-layout">{modelItems.map(item => <article className="management-feature" key={item.id}>
        {item.is_demo && <span className="demo-label">ตัวอย่างเนื้อหา DEMO</span>}
        {item.image_url && <img className="model-image" src={item.image_url} alt={item.title} />}
        <div className="management-feature-head"><span className="management-symbol">M</span><div><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}</div></div>
        <RichTextContent className="rich-text-view" html={item.content?.text || ''} />
        <div className="management-pillars"><span>01 วิเคราะห์</span><span>02 วางแผน</span><span>03 ลงมือทำ</span><span>04 ประเมินผล</span><span>05 พัฒนา</span></div>
      </article>)}
        <aside className="management-side-note"><span>OUR APPROACH</span><b>คิดเป็นระบบ<br/>ทำงานเป็นทีม<br/>พัฒนาอย่างต่อเนื่อง</b><p>เชื่อมโยงเป้าหมายกับการปฏิบัติจริง และใช้ผลลัพธ์เป็นฐานในการพัฒนา</p></aside>
      </div>
    </section>
    <section className="section-wrap additional-section gallery-section" id="activity-gallery">
      <div className="section-heading"><div><div className="section-kicker">PART 05 · SCHOOL GALLERY</div><h2>ภาพกิจกรรมต่าง ๆ</h2></div><span className="section-note">MOMENTS THAT MATTER</span></div>
      <div className="activity-gallery-grid">{photoItems.map(photo => <figure className="activity-photo" key={photo.id}>
        {photo.is_demo ? <div className={\`demo-photo-art demo-photo-\${photo.art}\`}><span>{photo.symbol}</span><small>PHOTO COMING SOON</small></div> : <img src={photo.image_url} alt={photo.alt_text || photo.title} loading="lazy" />}
        <figcaption>{photo.is_demo && <span className="demo-label">ภาพตัวอย่าง</span>}<b>{photo.title}</b>{photo.description && <p>{photo.description}</p>}</figcaption>
      </figure>)}</div>
    </section>
  </>;
}
