import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import DOMPurify from 'dompurify';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function toRichHtml(value = '') {
  const text = String(value ?? '');
  if (!text) return '';
  if (/<(?:p|h[1-6]|ul|ol|li|blockquote|strong|em|u|a|br)\b/i.test(text)) return text;
  return text.split(/\n{2,}/).map(part => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
}

export function RichTextContent({ html = '', className = '' }) {
  const safeHtml = DOMPurify.sanitize(toRichHtml(html), { USE_PROFILES: { html: true } });
  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

function ToolButton({ children, title, active = false, disabled = false, onClick }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled}
    className={active ? 'is-active' : ''} onMouseDown={event => event.preventDefault()}
    onClick={onClick}>{children}</button>;
}

export function RichTextEditor({ label, value = '', onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] })
    ],
    content: toRichHtml(value),
    editorProps: { attributes: { class: 'tiptap', 'aria-label': label || 'พื้นที่เขียนเนื้อหา', spellcheck: 'true' } },
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML())
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = toRichHtml(value);
    if (incoming !== editor.getHTML()) editor.commands.setContent(incoming, false);
  }, [editor, value]);

  if (!editor) return <div className="rich-text-editor">กำลังเตรียมเครื่องมือเขียนข้อความ…</div>;

  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('ใส่ URL ของลิงก์', previous);
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return <div className="rich-text-editor">
    <div className="rich-text-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบข้อความ">
      <ToolButton title="ตัวหนา" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolButton>
      <ToolButton title="ตัวเอียง" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolButton>
      <ToolButton title="ขีดเส้นใต้" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
      <ToolButton title="ขีดฆ่า" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolButton>
      <span className="rich-text-divider" />
      <ToolButton title="หัวข้อใหญ่" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
      <ToolButton title="หัวข้อย่อย" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
      <ToolButton title="ข้อความปกติ" onClick={() => editor.chain().focus().setParagraph().run()}>¶</ToolButton>
      <span className="rich-text-divider" />
      <ToolButton title="รายการแบบจุด" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolButton>
      <ToolButton title="รายการแบบตัวเลข" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolButton>
      <ToolButton title="ข้อความอ้างอิง" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolButton>
      <span className="rich-text-divider" />
      <ToolButton title="ชิดซ้าย" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>ชิดซ้าย</ToolButton>
      <ToolButton title="กึ่งกลาง" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>กึ่งกลาง</ToolButton>
      <ToolButton title="ชิดขวา" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>ชิดขวา</ToolButton>
      <ToolButton title="แทรก/แก้ไขลิงก์" active={editor.isActive('link')} onClick={setLink}>🔗</ToolButton>
      <span className="rich-text-divider" />
      <ToolButton title="ย้อนกลับ" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</ToolButton>
      <ToolButton title="ทำซ้ำ" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</ToolButton>
    </div>
    <div className="rich-text-content"><EditorContent editor={editor} /></div>
    <small className="rich-text-help">เลือกข้อความก่อนกดปุ่มจัดรูปแบบ · ระบบบันทึกเนื้อหาเป็น HTML เพื่อแสดงผลบนเว็บไซต์</small>
  </div>;
}
