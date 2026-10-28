"use client";

import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resumePayment } from "@/features/checkout/actions";

export function ResumePaymentButton({ orderId, size = "md" }: { orderId: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={size}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resumePayment(orderId);
          if (!result.ok) {
            toast.error(result.error);
            router.refresh();
            return;
          }
          if (result.data.url.startsWith("http")) window.location.assign(result.data.url);
          else router.push(result.data.url);
        })
      }
    >
      <CreditCard /> Pagar ahora
    </Button>
  );
}
