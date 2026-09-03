import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "emprendedor") redirect("/login");
  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border bg-white p-2 text-sm font-bold">
        <Link
          className="rounded-xl px-4 py-2 hover:bg-[#e8efe8]"
          href="/dashboard"
        >
          Resumen
        </Link>
        <Link
          className="rounded-xl px-4 py-2 hover:bg-[#e8efe8]"
          href="/dashboard/productos"
        >
          Productos
        </Link>
        <Link
          className="rounded-xl px-4 py-2 hover:bg-[#e8efe8]"
          href="/dashboard/pedidos"
        >
          Pedidos
        </Link>
      </div>
      {children}
    </div>
  );
}
