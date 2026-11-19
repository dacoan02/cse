import type { CSSProperties } from "react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/app-shell";
import { ROLE_LABEL } from "@/lib/labels";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", s.userId).eq("is_read", false).eq("is_archived", false);

  const nav: (NavItem | false)[] = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    !s.isObserver && { href: "/adunarea-generala", label: "Adunarea Generală", icon: "Users" },
    { href: "/sedinte", label: "Ședințe", icon: "CalendarDays" },
    { href: "/calendar", label: "Calendar", icon: "Calendar" },
    { href: "/voturi", label: "Voturi și decizii", icon: "Vote" },
    !s.isObserver && { href: "/vocea-reprezentantilor", label: "Vocea reprezentanților", icon: "MessageSquareText" },
    { href: "/proiecte", label: "Proiecte și activități", icon: "FolderKanban" },
    !s.isObserver && { href: "/anunturi", label: "Anunțuri", icon: "Megaphone" },
    { href: "/documente", label: "Documente și arhivă", icon: "FileText" },
    s.can("view_statistics") && { href: "/statistici", label: "Statistici", icon: "BarChart3" },
    s.isPresident && { href: "/reprezentanti", label: "Managementul reprezentanților", icon: "ShieldAlert" },
    s.can("view_audit") && { href: "/istoric", label: "Istoric și activitate", icon: "History" },
    { href: "/setari", label: "Setări", icon: "Settings" },
  ];
  const color = s.institution.primary_color;
  return (
    <div style={{ "--brand": color } as CSSProperties}>
      <AppShell nav={nav.filter(Boolean) as NavItem[]} userName={s.profile.full_name} roleLabel={ROLE_LABEL[s.profile.role]}
        councilName={s.institution.council_name} institutionName={s.institution.name} unread={count ?? 0} userId={s.userId} logo={s.institution.logo_path}>
        {!s.year && <div className="mb-4"><Alert tone="warn">Nu există un an școlar activ. Președintele trebuie să configureze unul din Setări.</Alert></div>}
        {children}
      </AppShell>
    </div>
  );
}
