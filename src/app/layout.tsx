import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { getGeo } from "@/features/location/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Catarina Market · Artesanías, plantas y flores de Catarina",
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
      className={`${inter.variable} ${fraunces.variable}`}
    >
      <body className="min-h-dvh">
        <Providers geo={geo}>{children}</Providers>
      </body>
    </html>
  );
}
