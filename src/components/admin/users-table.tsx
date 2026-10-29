"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { createAdminUser, updateUser } from "@/features/admin/actions";
import { formatDate } from "@/lib/utils";
import type { Profile, Role } from "@/types/domain";

// Los repartidores se crean y gestionan en /admin/repartidores.
const ROLES: Record<Exclude<Role, "courier">, string> = {
  customer: "Cliente",
  vendor: "Vendedor",
  admin: "Admin",
};

export function UserRow({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (role: Role, active: boolean) =>
    startTransition(async () => {
      const result = await updateUser({ userId: user.id, role, active });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Usuario actualizado.");
      router.refresh();
    });

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-3">
      <Avatar
        name={user.full_name || user.email || "?"}
        url={user.avatar_url}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {user.full_name || "Sin nombre"}{" "}
          {isSelf && <Badge tone="brand">Tú</Badge>}
        </p>
        <p className="text-muted-foreground truncate text-sm">
          {user.email} · desde {formatDate(user.created_at, false)}
        </p>
      </div>
      {user.role === "courier" ? (
        <Link
          href="/admin/repartidores"
          className="text-primary text-sm font-medium hover:underline"
        >
          Repartidor · gestionar
        </Link>
      ) : (
        <>
          <Select
            aria-label="Rol"
            className="h-9 w-36"
            value={user.role}
            disabled={isSelf || pending}
            onChange={(e) => {
              const role = e.target.value as Role;
              if (
                role === "admin" &&
                !confirm(`¿Dar acceso de administrador a ${user.email}?`)
              )
                return;
              save(role, user.is_active);
            }}
          >
            {Object.entries(ROLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              checked={user.is_active}
              disabled={isSelf || pending}
              onCheckedChange={(active) =>
                save(user.role as Exclude<Role, "courier">, active)
              }
            />
            <span className={user.is_active ? "" : "text-destructive"}>
              {user.is_active ? "Activa" : "Desactivada"}
            </span>
          </div>
        </>
      )}
    </li>
  );
}

export function CreateAdminButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Nuevo administrador
      </Button>
      {open && (
        <DialogContent
          title="Nuevo administrador"
          description="Comparte la contraseña temporal por un canal seguro."
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await createAdminUser(form);
                if (!result.ok) return void toast.error(result.error);
                toast.success("Administrador creado.");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="Nombre" htmlFor="admin-name">
              <Input
                id="admin-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </Field>
            <Field label="Correo" htmlFor="admin-email">
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field
              label="Contraseña temporal"
              htmlFor="admin-pass"
              hint="Mínimo 8 caracteres."
            >
              <Input
                id="admin-pass"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
              Crear administrador
            </Button>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
