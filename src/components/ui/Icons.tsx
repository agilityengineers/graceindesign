export const ArrowRight = ({ size = 14, color = "currentColor", width = 2.2 }: { size?: number; color?: string; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ArrowLeft = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ArrowUpRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const Check = ({ size = 14, color = "#3f9ad9" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const Close = ({ size = 14, color = "#1a2238" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Phone = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6cb6e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.8 2z" /></svg>);
export const Mail = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6cb6e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>);
export const Chevron = ({ color = "currentColor" }: { color?: string }) => (<svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" /></svg>);
export const Play = ({ size = 14, color = "#fff" }: { size?: number; color?: string }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>);
export const Rss = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" /><circle cx="5" cy="19" r="1" fill="#f0a500" /></svg>);
export const Heart = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" stroke="#1a2238" strokeWidth="1.8" strokeLinejoin="round" /></svg>);
export const Star = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" stroke="#3f9ad9" strokeWidth="1.8" strokeLinejoin="round" /></svg>);
export const Globe = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3f9ad9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>);
export const Upload = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6cb6e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>);
export const Compare = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" stroke="#1a2238" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
export const Social = {
  Facebook: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V11H7v4h3v9h4v-9h3l1-4h-4V8.6c0-.4.3-.6.7-.6z" /></svg>),
  Instagram: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>),
  LinkedIn: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9h4v12H4zM6 3a2 2 0 110 4 2 2 0 010-4zm5 6h3.8v1.7c.6-1 1.9-2 3.9-2 4 0 4.3 2.6 4.3 6V21h-4v-5.5c0-1.4 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4z" /></svg>),
  Pinterest: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.5 0-2.4-1.7-4-4.1-4-2.8 0-4.5 2.1-4.5 4.3 0 .9.3 1.8.7 2.3.1.1.1.2.1.3l-.3 1.1c0 .2-.1.2-.3.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.1-5.1 6.1-1 0-1.9-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.6A10 10 0 1012 2z" /></svg>),
  YouTube: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12 31 31 0 001 16.8a3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1A31 31 0 0023.5 12 31 31 0 0023 7.2zM9.7 15.1V8.9l6 3.1z" /></svg>),
};
