"use client";
import { useEffect } from "react";

/** Adds the scroll-reveal behavior to every `.reveal` element on the page. */
export default function Reveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
  return null;
}
