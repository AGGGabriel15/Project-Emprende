import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl rounded-[2rem] border bg-white p-7 shadow-xl shadow-[#174936]/5 sm:p-10">
        <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
          Únete a la comunidad
        </p>
        <h1 className="mt-2 text-4xl font-bold">Crea tu cuenta</h1>
        <p className="mt-3 mb-8 text-sm text-[#65736b]">
          Compra productos locales o solicita un espacio para mostrar tu
          emprendimiento.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
