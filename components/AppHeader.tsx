"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="15" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="15" width="6" height="6" rx="1.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M20 20a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="3.5" />
    </svg>
  );
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: GridIcon },
  { label: "Find Jobs", href: "/find-jobs", icon: SearchIcon },
  { label: "Profile", href: "/profile", icon: UserIcon },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-[84px] max-w-[1720px] items-center justify-between gap-8 px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-4">
          <Image src="/logo.png" alt="JobPilot" width={46} height={46} className="rounded-[14px]" priority />
          <span className="text-[19px] font-bold leading-7 text-text-darkest">JobPilot</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-[12px] px-5 py-3 text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-text-dark hover:text-text-primary"
                }`}
              >
                <span className={active ? "text-accent" : "text-text-muted"}><Icon /></span>
                <span>{item.label}</span>
                {active ? <span className="absolute inset-x-0 -bottom-[16px] h-[2px] rounded-full bg-accent" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
