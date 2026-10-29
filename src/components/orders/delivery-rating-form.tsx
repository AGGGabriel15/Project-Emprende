"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { RATING_TAGS } from "@/features/couriers/status";
import { rateDelivery } from "@/features/orders/actions";
import { cn } from "@/lib/utils";

/** El cliente califica la entrega del repartidor. */
export function DeliveryRatingForm({ orderId, courierName }: { orderId: string; courierName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = (tag: string) => setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await rateDelivery({ orderId, rating, tags, comment });
          if (!result.ok) return void toast.error(result.error);
          toast.success("¡Gracias por calificar la entrega!");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">¿Cómo te atendió {courierName.split(" ")[0]}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación del repartidor" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrellas para el repartidor`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer p-0.5"
          >
            <Star className={cn("size-8 transition", n <= (hover || rating) ? "fill-warning text-warning" : "text-border")} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {RATING_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            onClick={() => toggle(tag)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition",
              tags.includes(tag) ? "border-primary bg-primary-soft text-primary" : "hover:border-primary",
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        maxLength={500}
        aria-label="Comentario sobre la entrega"
        placeholder="Comentario para Catarina Market (opcional)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <Button type="submit" disabled={!rating} loading={pending}>
        Calificar entrega
      </Button>
    </form>
  );
}
