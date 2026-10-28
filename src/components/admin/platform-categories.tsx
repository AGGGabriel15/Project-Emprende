"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/catalog/product-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { savePlatformCategory } from "@/features/admin/actions";
import type { PlatformCategory } from "@/types/domain";

const ICONS = Object.keys(CATEGORY_ICONS);

export function PlatformCategoriesManager({ categories }: { categories: PlatformCategory[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ name: "", icon: "package" });

  const save = (input: { name: string; icon: string; isActive: boolean }, id?: number, after?: () => void) =>
    startTransition(async () => {
      const result = await savePlatformCategory(input, id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Categoría guardada.");
      after?.();
      router.refresh();
    });

  return (
    <Card>
      <form
        className="flex flex-wrap gap-2 border-b p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save({ ...draft, isActive: true }, undefined, () => setDraft({ name: "", icon: "package" }));
        }}
      >
        <Input className="flex-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nueva categoría" aria-label="Nombre" />
        <Select className="w-36" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} aria-label="Ícono">
          {ICONS.map((icon) => (
            <option key={icon}>{icon}</option>
          ))}
        </Select>
        <Button type="submit" disabled={draft.name.trim().length < 2} loading={pending}>
          Agregar
        </Button>
      </form>
      <ul className="divide-y">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <CategoryIcon icon={c.icon} className="size-4" />
            </span>
            <span className="flex-1 font-medium">{c.name}</span>
            <span className="text-xs text-muted-foreground">/{c.slug}</span>
            <Switch checked={c.is_active} disabled={pending} onCheckedChange={(isActive) => save({ name: c.name, icon: c.icon, isActive }, c.id)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
