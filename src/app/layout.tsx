import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Emprendedores Unidos de Catarina",
    template: "%s | Emprendedores Unidos",
  },
  description:
    "Artesanías, plantas y sabores creados por emprendedores de Catarina.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-160px)]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
