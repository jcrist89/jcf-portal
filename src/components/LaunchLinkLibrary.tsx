"use client";

import { useState } from "react";
import { LAUNCH_LINKS } from "@/lib/launchOps";

export function LaunchLinkLibrary() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, path: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {LAUNCH_LINKS.map((link) => (
        <div key={link.key} className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-4">
          <div className="text-sm font-medium text-white">{link.label}</div>
          <div className="mt-1 text-xs text-jcf-gray">{link.purpose}</div>
          <div className="mt-3 break-all rounded-xl border border-white/10 bg-jcf-black/40 p-3 font-mono text-[10px] text-jcf-gray">
            {link.path}
          </div>
          <button
            type="button"
            onClick={() => copy(link.key, link.path)}
            className="mt-3 rounded-xl bg-[#FF6B1A] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black"
          >
            {copied === link.key ? "Copied" : "Copy link"}
          </button>
        </div>
      ))}
    </div>
  );
}
