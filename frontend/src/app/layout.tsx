import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LocaleWrapper } from "@/components/LocaleWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Builder",
  description: "AI Agent Development Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="dark">
      <body className={inter.className}>
        <LocaleWrapper>{children}</LocaleWrapper>
      </body>
    </html>
  );
}
