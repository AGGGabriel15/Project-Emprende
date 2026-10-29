import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { getGeo } from "@/features/location/server";
import "./globals.css";

/** Tipografías del manual: Outfit (logotipo, títulos y botones) y DM Sans (textos e interfaz). */
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: {
    default: "Catarina Market",
    template: "%s · Catarina Market",
  },
  description:
    "Compra directo a los negocios de Catarina, Masaya: artesanías, plantas, flores y decoración con delivery o para llevar.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const geo = await getGeo();
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${outfit.variable}`}
    >
      <body className="min-h-dvh">
        <Providers geo={geo}>{children}</Providers>
      </body>
    </html>
  );
}
