import Link from "next/link";
import { Gauge, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white">
            <Search size={18} aria-hidden="true" />
          </span>
          <span className="truncate text-lg font-bold tracking-tight text-brand">Precision Mirror Finder</span>
        </Link>
        <Link
          href="/admin"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-field px-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <Gauge size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      </div>
    </header>
  );
}
