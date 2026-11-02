import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            El mercado en línea de los artesanos y viveros de Catarina, Masaya.
            Compras directo al negocio que lo hace.
          </p>
        </div>
        <FooterColumn
          title="Comprar"
          links={[
            ["/buscar", "Explorar productos"],
            ["/negocios", "Negocios"],
            ["/carrito", "Carrito"],
            ["/pedidos", "Mis pedidos"],
          ]}
        />
        <FooterColumn
          title="Vender"
          links={[
            ["/vender", "Vender en Catarina Market"],
            ["/vendedor/solicitud", "Solicitud de negocio"],
            ["/vendedor/panel", "Panel del vendedor"],
          ]}
        />
        <FooterColumn
          title="Ayuda"
          links={[
            ["/politicas#entregas", "Tiempos de entrega"],
            ["/politicas#reembolsos", "Política de reembolso"],
            ["/politicas#devoluciones", "Devoluciones y garantías"],
            ["/politicas#reclamos", "Cómo hacer un reclamo"],
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            ["/terminos", "Términos y condiciones"],
            ["/privacidad", "Aviso de privacidad (Ley 787)"],
            ["/seguridad", "Seguridad del sitio (Ley 1042)"],
            ["/politicas", "Derechos del consumidor (Ley 842)"],
          ]}
        />
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Catarina Market · Catarina, Masaya, Nicaragua
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
