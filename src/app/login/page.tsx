import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="container-page grid min-h-[680px] place-items-center py-12">
      <div className="w-full max-w-md rounded-[2rem] border bg-white p-7 shadow-xl shadow-[#174936]/5 sm:p-10">
        <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
          Bienvenido de vuelta
        </p>
        <h1 className="mt-2 text-4xl font-bold">Ingresa a tu cuenta</h1>
        <p className="mt-3 mb-8 text-sm leading-6 text-[#65736b]">
          Administra tus compras o haz crecer tu negocio local.
        </p>
        <Suspense fallback={<p>Cargando…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
