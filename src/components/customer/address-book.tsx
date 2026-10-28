"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useGeo } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { deleteAddress } from "@/features/account/actions";
import type { Address } from "@/types/domain";
import { AddressForm } from "./address-form";
import { formatPhone } from "@/lib/phone";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(address: Address) {
    if (!confirm(`¿Eliminar la dirección “${address.label}”?`)) return;
    startTransition(async () => {
      const result = await deleteAddress(address.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Dirección eliminada.");
      router.refresh();
    });
  }

  return (
    <div>
      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title="Sin direcciones guardadas"
          description="Agrega una para pagar con delivery más rápido."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus /> Agregar dirección
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {address.label}{" "}
                  {address.is_default && <Badge tone="brand">Principal</Badge>}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Editar" onClick={() => setEditing(address)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Eliminar" disabled={pending} onClick={() => remove(address)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <AddressSummary address={address} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="size-5" /> Agregar dirección
          </button>
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing !== null && (
          <DialogContent side="sheet" title={editing === "new" ? "Nueva dirección" : "Editar dirección"}>
            <AddressForm
              address={editing === "new" ? undefined : editing}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export function AddressSummary({ address }: { address: Address }) {
  const { departments, municipalities } = useGeo();
  const municipality = municipalities.find((m) => m.id === address.municipality_id)?.name;
  const department = departments.find((d) => d.id === address.department_id)?.name;
  return (
    <div className="mt-1 text-sm text-muted-foreground">
      <p>{address.address_line}</p>
      <p>
        {municipality}, {department}
      </p>
      <p className="mt-1">
        Recibe {address.recipient_name} · {formatPhone(address.phone)}
      </p>
    </div>
  );
}
