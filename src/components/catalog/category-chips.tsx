import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PlatformCategory } from "@/types/domain";
import { CategoryIcon } from "./product-image";

export function CategoryChips({
  categories,
  active,
  baseHref = "/buscar",
  params = {},
}: {
  categories: PlatformCategory[];
  active?: string;
  baseHref?: string;
  params?: Record<string, string | undefined>;
}) {
  const href = (slug?: string) => {
    const search = new URLSearchParams(
      Object.entries({ ...params, categoria: slug }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    ).toString();
    return search ? `${baseHref}?${search}` : baseHref;
  };
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Chip href={href()} active={!active}>
        Todo
      </Chip>
      {categories.map((category) => (
        <Chip key={category.id} href={href(category.slug)} active={active === category.slug}>
          <CategoryIcon icon={category.icon} className="size-4" />
          {category.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}
