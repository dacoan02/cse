import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Consiliul Școlar al Elevilor", template: "%s · Consiliul Școlar al Elevilor" },
  description: "Platformă digitală pentru organizarea și administrarea activității Consiliului Școlar al Elevilor.",
  applicationName: "Consiliul Elevilor",
  appleWebApp: { capable: true, title: "Consiliul Elevilor", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('cse-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
