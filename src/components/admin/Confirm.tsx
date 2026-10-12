"use client";
/** A form submit button that confirms before firing its server action (used for deletes). */
export default function ConfirmButton({ children, message = "Delete this record? This cannot be undone.", className = "link-btn link-danger", style, name, value, title }: { children: React.ReactNode; message?: string; className?: string; style?: React.CSSProperties; name?: string; value?: string; title?: string }) {
  return <button type="submit" name={name} value={value} title={title} className={className} style={style} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
