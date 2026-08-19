import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  Space_Mono,
} from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/shared/app-shell";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: "400",
  variable: "--font-space-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Butaca",
  description: "Descubrimiento de películas y recomendaciones personales.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${bricolage.variable} ${instrument.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
