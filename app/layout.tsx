import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나이트룸 · 체스 & 채팅",
  description: "온라인 대국과 채팅을 한곳에서.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head><link rel="preload" href="/fonts/knight-chess.woff" as="font" type="font/woff" crossOrigin="anonymous" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
