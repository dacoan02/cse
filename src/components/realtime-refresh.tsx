"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Se abonează la modificările din baza de date (Supabase Realtime) și reîmprospătează datele paginii.
 * Respectă RLS: primești doar evenimentele pentru rândurile pe care ai dreptul să le vezi.
 */
export function RealtimeRefresh({ tables, filter }: { tables: string[]; filter?: Record<string, string> }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 300); };
    const channel = supabase.channel("rt-" + tables.join("-") + "-" + Math.random().toString(36).slice(2));
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter?.[table] ? { filter: filter[table] } : {}) }, refresh);
    }
    channel.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [router, tables.join(","), JSON.stringify(filter)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
