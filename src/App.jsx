import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  const [status, setStatus] = useState('กำลังตรวจสอบการเชื่อมต่อข้อมูล…');

  useEffect(() => {
    let active = true;
    async function check() {
      if (!supabase) {
        if (active) setStatus('ยังไม่ได้ตั้งค่า Supabase — เว็บไซต์อยู่ระหว่างเตรียมระบบ');
        return;
      }
      const { error } = await supabase.from('site_settings').select('setting_key').eq('is_public', true).limit(1);
      if (active) setStatus(error ? 'ฐานข้อมูลยังไม่พร้อมเชื่อมต่อ กรุณาตรวจสอบการตั้งค่า' : 'เชื่อมต่อฐานข้อมูลแล้ว — กำลังเตรียมเนื้อหาเว็บไซต์');
    }
    check();
    return () => { active = false; };
  }, []);

  return (
    <main className="page">
      <header className="topbar"><span className="brand-mark">ผ</span><span>เว็บไซต์ผู้อำนวยการ</span></header>
      <section className="hero">
        <p className="eyebrow">DIRECTOR'S WEBSITE</p>
        <h1>โรงเรียนอนุบาลชุมแสง<br /> (วัดทับกฤชกลาง)</h1>
        <p className="intro">พื้นที่สื่อสาร วิสัยทัศน์ ผลงาน และข่าวสารการพัฒนาการศึกษา</p>
        <div className="status" role="status">{status}</div>
      </section>
      <footer>เว็บไซต์อยู่ระหว่างการพัฒนา · เนื้อหาจะจัดการผ่านระบบ CMS</footer>
    </main>
  );
}
