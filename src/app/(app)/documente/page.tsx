import { Download, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { DeleteDocumentButton, UploadDocumentButton } from "@/components/document-controls";
import { DOC_CATEGORY_LABEL } from "@/lib/labels";
import { formatBytes, formatDateShort } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

export const metadata = { title: "Documente și arhivă" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  let q = supabase.from("documents").select("*,meetings(title)").is("feedback_id", null).is("announcement_id", null).order("created_at", { ascending: false }).limit(300);
  if (sp.categorie) q = q.eq("category", sp.categorie);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
  if (sp.de_la) q = q.gte("created_at", sp.de_la);
  if (sp.pana_la) q = q.lte("created_at", sp.pana_la + "T23:59:59");
  const [{ data }, members, { data: meetings }] = await Promise.all([
    q, getMembers(supabase),
    s.can("manage_documents") ? supabase.from("meetings").select("id,title").neq("status", "draft").order("starts_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
  ]);
  const rows = (data ?? []) as (DocumentRow & { meetings: { title: string } | null })[]; const names = nameMap(members);
  const canManage = s.can("manage_documents");
  return (
    <>
      <PageHeader title="Documente și arhivă" description="Convocatoare, procese-verbale, hotărâri, rapoarte și regulamente. Accesul depinde de permisiunile tale."
        actions={canManage && <UploadDocumentButton meetings={(meetings ?? []) as { id: string; title: string }[]} />} />
      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <Input name="q" placeholder="Caută după titlu…" defaultValue={sp.q} aria-label="Caută după titlu" className="lg:col-span-2" />
        <Select name="categorie" defaultValue={sp.categorie ?? ""} aria-label="Categorie"><option value="">Toate categoriile</option>{Object.entries(DOC_CATEGORY_LABEL).filter(([k]) => k !== "atasament").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Input type="date" name="de_la" defaultValue={sp.de_la} aria-label="De la data" />
        <div className="flex gap-2"><Input type="date" name="pana_la" defaultValue={sp.pana_la} aria-label="Până la data" /><Button type="submit" variant="secondary">Caută</Button></div>
      </form>
      {rows.length === 0 ? <EmptyState icon={<FileText className="h-8 w-8" />} title="Niciun document" description={canManage ? "Încarcă primul document în arhivă." : "Documentele la care ai acces vor apărea aici."} /> : (
        <Card><Table>
          <thead><tr><Th>Document</Th><Th>Categorie</Th><Th>Ședința</Th><Th>Încărcat</Th><Th>Acțiuni</Th></tr></thead>
          <tbody>{rows.map((d) => (
            <tr key={d.id} className="hover:bg-surface2/50">
              <Td><span className="font-medium">{d.title}</span>{d.visibility === "conducere" && <> <Badge>Conducere</Badge></>}<div className="text-xs text-muted">{d.file_name} {formatBytes(d.size_bytes) && `· ${formatBytes(d.size_bytes)}`}</div></Td>
              <Td>{DOC_CATEGORY_LABEL[d.category]}</Td><Td>{d.meetings?.title ?? "—"}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateShort(d.created_at)}<br />{d.uploaded_by ? names[d.uploaded_by] ?? "" : ""}</Td>
              <Td><div className="flex items-center gap-1"><a href={`/api/documente/${d.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface2"><Download className="h-4 w-4" aria-hidden />Descarcă</a>{canManage && <DeleteDocumentButton id={d.id} title={d.title} />}</div></Td>
            </tr>))}</tbody></Table></Card>)}
    </>
  );
}
