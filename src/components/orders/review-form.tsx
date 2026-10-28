"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { submitReview } from "@/features/orders/actions";
import { cn } from "@/lib/utils";

export function ReviewForm({ orderId, businessName }: { orderId: string; businessName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await submitReview({ orderId, rating, comment });
          if (!result.ok) return void toast.error(result.error);
          toast.success("¡Gracias por tu reseña!");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">¿Cómo te fue con {businessName}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrellas`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer p-0.5"
          >
            <Star className={cn("size-8 transition", n <= (hover || rating) ? "fill-warning text-warning" : "text-border")} />
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        maxLength={500}
        placeholder="Cuéntale a otros clientes (opcional)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <Button type="submit" disabled={!rating} loading={pending}>
        Publicar reseña
      </Button>
    </form>
  );
}
