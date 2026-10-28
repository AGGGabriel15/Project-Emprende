"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

export function ProductGallery({
  images,
  name,
  icon,
}: {
  images: string[];
  name: string;
  icon?: string | null;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <ProductImage
        src={images[active]}
        alt={name}
        icon={icon}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="aspect-square rounded-(--radius-card) border"
      />
      {images.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Ver foto ${index + 1}`}
              aria-current={index === active}
              className={cn(
                "relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition",
                index === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
