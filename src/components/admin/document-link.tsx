"use client";

import { ExternalLink } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentUrl } from "@/features/admin/actions";

export function DocumentLink({ path }: { path: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await documentUrl(path);
          if (!result.ok) return void toast.error(result.error);
          window.open(result.data, "_blank", "noopener");
        })
      }
    >
      <ExternalLink /> Ver
    </Button>
  );
}
