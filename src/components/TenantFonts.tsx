"use client";
import { useEffect } from "react";

export function TenantFonts({ fontBody, fontDisp }: { fontBody?: string; fontDisp?: string }) {
  useEffect(() => {
    if (!fontBody && !fontDisp) return;
    const fams: string[] = [];
    if (fontDisp) fams.push(fontDisp.replace(/ /g, "+") + ":wght@500;600");
    if (fontBody) fams.push(fontBody.replace(/ /g, "+") + ":wght@400;600;700");
    let l = document.getElementById("tenant-fonts") as HTMLLinkElement | null;
    if (!l) { l = document.createElement("link"); l.id = "tenant-fonts"; l.rel = "stylesheet";
      document.head.appendChild(l); }
    l.href = "https://fonts.googleapis.com/css2?family=" + fams.join("&family=") + "&display=swap";
    if (fontDisp) document.documentElement.style.setProperty("--font-disp", `'${fontDisp}',Georgia,serif`);
    if (fontBody) document.documentElement.style.setProperty("--font-ui", `'${fontBody}',sans-serif`);
    return () => {
      document.documentElement.style.removeProperty("--font-disp");
      document.documentElement.style.removeProperty("--font-ui");
      l?.remove();
    };
  }, [fontBody, fontDisp]);
  return null;
}