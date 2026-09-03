import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const links = [
  { href: "/admin", label: "Reportes" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/emprendedores", label: "Emprendedores" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/productos", label: "Productos" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") redirect("/login");
  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border bg-white p-2 text-sm font-bold">
        {links.map((link) => (
          <Link
            key={link.href}
            className="rounded-xl px-4 py-2 hover:bg-[#e8efe8]"
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
