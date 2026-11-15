import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Consiliul Școlar al Elevilor", template: "%s · Consiliul Școlar al Elevilor" },
  description: "Platformă digitală pentru organizarea și administrarea activității Consiliului Școlar al Elevilor.",
};

const themeScript = `try{var t=localStorage.getItem('cse-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
