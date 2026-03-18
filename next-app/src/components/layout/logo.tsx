"use client";

import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="group relative inline-block font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
      aria-label="CrawliT – Home"
    >
      <span className="relative inline-block text-lg tracking-tight transition-[letter-spacing,transform] duration-300 ease-out group-hover:tracking-wide">
        Crawli
      </span>
      <span className="relative inline-block text-lg tracking-tight transition-[letter-spacing,transform] duration-300 ease-out group-hover:tracking-wide group-hover:translate-y-[-2px]">
        T
      </span>
      <span
        className="absolute bottom-0 left-0 block h-px w-0 bg-white/70 transition-[width] duration-300 ease-out group-hover:w-full"
        aria-hidden
      />
    </Link>
  );
}
