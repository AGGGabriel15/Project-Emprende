"use client";

import { Menu, ShoppingBasket, Sprout, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";

export function Header() {
  const { data: session, status } = useSession();
  const itemCount = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const [open, setOpen] = useState(false);
  const dashboard =
    session?.user.role === "admin"
      ? "/admin"
      : session?.user.role === "emprendedor"
        ? "/dashboard"
        : "/mis-pedidos";

  return (
    <header className="sticky top-0 z-40 border-b border-[#dfe6de] bg-[#fbfaf5]/95 backdrop-blur">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#174936]"
          onClick={() => setOpen(false)}
        >
          <span className="grid size-10 place-items-center rounded-full bg-[#236b4e] text-white">
            <Sprout size={21} />
          </span>
          <span className="leading-tight">
            <strong className="block font-serif text-lg">
              Emprendedores Unidos
            </strong>
            <span className="block text-[10px] font-bold tracking-[0.22em] uppercase">
              Catarina
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-7 text-sm font-semibold md:flex"
          aria-label="Principal"
        >
          <Link href="/productos" className="hover:text-[#236b4e]">
            Productos
          </Link>
          <Link href="/categorias/artesanias" className="hover:text-[#236b4e]">
            Artesanías
          </Link>
          <Link href="/categorias/plantas" className="hover:text-[#236b4e]">
            Plantas
          </Link>
          <Link href="/categorias/comida" className="hover:text-[#236b4e]">
            Comida
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/carrito"
            className="relative grid size-11 place-items-center rounded-full hover:bg-black/5"
            aria-label={`Carrito, ${itemCount} artículos`}
          >
            <ShoppingBasket size={21} />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-[#e89c3f] text-[10px] font-bold text-[#183127]">
                {itemCount}
              </span>
            )}
          </Link>
          {status !== "loading" &&
            (session ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={dashboard}>Mi panel</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Salir
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Ingresar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/registro">Crear cuenta</Link>
                </Button>
              </>
            ))}
        </div>

        <button
          className="grid size-11 place-items-center md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Abrir menú"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-[#fbfaf5] px-4 py-5 md:hidden">
          <nav className="mx-auto flex max-w-lg flex-col gap-4 font-semibold">
            <Link href="/productos" onClick={() => setOpen(false)}>
              Productos
            </Link>
            <Link href="/categorias/artesanias" onClick={() => setOpen(false)}>
              Artesanías
            </Link>
            <Link href="/categorias/plantas" onClick={() => setOpen(false)}>
              Plantas
            </Link>
            <Link href="/categorias/comida" onClick={() => setOpen(false)}>
              Comida
            </Link>
            <Link href="/carrito" onClick={() => setOpen(false)}>
              Carrito ({itemCount})
            </Link>
            {session ? (
              <Link href={dashboard} onClick={() => setOpen(false)}>
                Mi panel
              </Link>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)}>
                Ingresar
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
