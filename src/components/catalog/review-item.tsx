import { Stars } from "@/components/catalog/rating";
import { Avatar } from "@/components/layout/account-menu";
import { formatDate } from "@/lib/utils";
import type { Review } from "@/types/domain";

/** Reseña con la foto y el nombre de quien compró. */
export function ReviewItem({ review, compact = false }: { review: Review; compact?: boolean }) {
  const name = review.author?.name || "Cliente";
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={review.author?.avatar_url} className={compact ? "size-8 text-xs" : "size-10"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <Stars value={review.rating} size={compact ? "size-3.5" : "size-4"} />
        </div>
        <span className="shrink-0 self-start text-xs text-muted-foreground">{formatDate(review.created_at, false)}</span>
      </div>
      {review.comment && <p className={compact ? "mt-1.5 text-muted-foreground" : "mt-3"}>{review.comment}</p>}
    </div>
  );
}
