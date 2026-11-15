import path from "node:path";
import Papa from "papaparse";

export interface Section { title: string; headers: string[]; rows: (string | number)[][] }

export function toCsv(sections: Section[]) {
  const out = sections.map((s) => `${s.title}\r\n${Papa.unparse([s.headers, ...s.rows], { newline: "\r\n" })}`).join("\r\n\r\n");
  return "﻿" + out; // BOM: Excel afișează corect diacriticele
}

export async function toXlsx(sections: Section[], meta: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook(); wb.creator = "Consiliul Școlar al Elevilor"; wb.created = new Date();
  for (const s of sections) {
    const ws = wb.addWorksheet(s.title.replace(/[\\/*?:[\]]/g, " ").slice(0, 31));
    ws.addRow([meta]).font = { italic: true, color: { argb: "FF64748B" } };
    ws.addRow([]);
    const h = ws.addRow(s.headers); h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }; });
    s.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c, i) => { c.width = Math.min(48, Math.max(12, ...[s.headers[i], ...s.rows.map((r) => r[i])].map((v) => String(v ?? "").length + 2))); });
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(sections: Section[], title: string, meta: string) {
  const pdfmake = (await import("pdfmake")).default as any;
  const f = path.join(process.cwd(), "node_modules/pdfmake/fonts/Roboto") + path.sep;
  pdfmake.setFonts({ Roboto: { normal: f + "Roboto-Regular.ttf", bold: f + "Roboto-Medium.ttf", italics: f + "Roboto-Italic.ttf", bolditalics: f + "Roboto-MediumItalic.ttf" } });
  pdfmake.setLocalAccessPolicy?.((p: string) => path.resolve(p).startsWith(path.resolve(f)));
  pdfmake.setUrlAccessPolicy?.(() => false);
  const content: any[] = [{ text: title, style: "h1" }, { text: meta, style: "meta" }];
  for (const s of sections) {
    content.push({ text: s.title, style: "h2" });
    if (s.rows.length === 0) { content.push({ text: "Nu există date pentru această secțiune în perioada aleasă.", italics: true, color: "#64748b", margin: [0, 0, 0, 6] }); continue; }
    content.push({ table: { headerRows: 1, widths: s.headers.map(() => "auto" as const), body: [s.headers.map((h) => ({ text: h, bold: true, color: "#ffffff", fillColor: "#1d4ed8" })), ...s.rows.map((r) => r.map((c) => ({ text: String(c ?? "") })))] },
      layout: "lightHorizontalLines", fontSize: 8, dontBreakRows: true });
  }
  const doc = { pageSize: "A4", pageOrientation: "landscape", pageMargins: [30, 36, 30, 36], defaultStyle: { font: "Roboto", fontSize: 9 },
    styles: { h1: { fontSize: 18, bold: true, color: "#0f172a" }, h2: { fontSize: 12, bold: true, color: "#1d4ed8", margin: [0, 14, 0, 6] }, meta: { color: "#64748b", margin: [0, 2, 0, 6] } },
    footer: (page: number, count: number) => ({ text: `Pagina ${page} din ${count}`, alignment: "center", fontSize: 8, color: "#94a3b8" }), content };
  return Buffer.from(await pdfmake.createPdf(doc).getBuffer());
}

