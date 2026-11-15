"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Calendar, Vote, MessageSquareText, FolderKanban, Megaphone, FileText,
  BarChart3, ShieldAlert, History, Settings, Bell, Menu, X, Sun, Moon, LogOut, Landmark,
} from "lucide-react";
import { Avatar } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const ICONS = { LayoutDashboard, Users, CalendarDays, Calendar, Vote, MessageSquareText, FolderKanban, Megaphone, FileText, BarChart3, ShieldAlert, History, Settings };
export interface NavItem { href: string; label: string; icon: keyof typeof ICONS }

export function AppShell({ nav, userName, roleLabel, councilName, institutionName, unread, userId, logo, children }: {
  nav: NavItem[]; userName: string; roleLabel: string; councilName: string; institutionName: string; unread: number; userId: string; logo?: string | null; children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("cse-theme", next ? "dark" : "light"); } catch { /* ignorat */ }
  }

  const sidebar = (
    <nav aria-label="Meniu principal" className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><Landmark className="h-5 w-5" aria-hidden /></span>}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{councilName}</p>
          <p className="truncate text-xs text-muted">{institutionName}</p>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((n) => {
          const Icon = ICONS[n.icon];
          const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href + "/"));
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />{n.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={userName} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-muted">{roleLabel}</p></div>
          <a href="/auth/signout" title="Deconectare" aria-label="Deconectare" className="rounded-md p-2 text-muted hover:bg-surface2 hover:text-ink"><LogOut className="h-4 w-4" /></a>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-app">
      <RealtimeRefresh tables={["notifications"]} filter={{ notifications: `user_id=eq.${userId}` }} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-surface transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`} aria-hidden={!open}>
        <button aria-label="Închide meniul" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1 text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
        {sidebar}
      </aside>
      <div className="lg:pl-64">
        <header data-app-header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button aria-label="Deschide meniul" onClick={() => setOpen(true)} className="rounded-md p-2 text-muted hover:bg-surface2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex-1" />
          <button onClick={toggleTheme} aria-label={dark ? "Mod luminos" : "Mod întunecat"} title={dark ? "Mod luminos" : "Mod întunecat"} className="rounded-md p-2 text-muted hover:bg-surface2 hover:text-ink">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link href="/notificari" aria-label={unread > 0 ? `Notificări, ${unread} necitite` : "Notificări"} className="relative rounded-md p-2 text-muted hover:bg-surface2 hover:text-ink">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-semibold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
