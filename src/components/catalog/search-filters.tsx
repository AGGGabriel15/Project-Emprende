"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";

/** Búsqueda, "Abierto ahora" y orden; todo vive en la URL. */
export function SearchFilters({ showSort = true }: { showSort?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("pagina");
    router.push(`${pathname}?${next}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: new FormData(event.currentTarget).get("q")?.toString().trim() || null });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          key={params.get("q")}
          name="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder="Busca por nombre o material…"
          className="h-11 w-full rounded-full border bg-card pr-4 pl-10 text-sm focus:border-primary focus:ring-3 focus:ring-primary/15 focus:outline-none"
        />
      </form>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Switch
            id="open-now"
            checked={params.get("abierto") === "1"}
            onCheckedChange={(checked) => update({ abierto: checked ? "1" : null })}
          />
          <label htmlFor="open-now" className="cursor-pointer whitespace-nowrap">
            Abierto ahora
          </label>
        </div>
        {showSort && (
          <Select
            aria-label="Ordenar"
            className="h-11 w-auto rounded-full"
            value={params.get("orden") ?? "recent"}
            onChange={(event) =>
              update({ orden: event.target.value === "recent" ? null : event.target.value })
            }
          >
            <option value="recent">Más recientes</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
          </Select>
        )}
      </div>
    </div>
  );
}
