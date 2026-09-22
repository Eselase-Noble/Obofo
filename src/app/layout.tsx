import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ɔbɔfo — WhatsApp alerts to your inbox",
  description:
    "Get an email or SMS when specific WhatsApp contacts message or call you — without opening WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
