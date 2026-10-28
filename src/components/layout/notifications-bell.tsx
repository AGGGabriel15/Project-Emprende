"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsRead } from "@/features/account/actions";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import type { Notification } from "@/types/domain";

/** Campana con avisos en tiempo real (tabla notifications vía Realtime). */
export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const unread = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => active && setItems((data ?? []) as Notification[]));

    const channel = supabase
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = payload.new as Notification;
          setItems((current) => [notification, ...current].slice(0, 15));
          toast(notification.title, { description: notification.body });
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && unread > 0) {
          setItems((current) =>
            current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
          );
          void markNotificationsRead();
        }
      }}
    >
      <DropdownMenuTrigger
        className="relative grid size-10 cursor-pointer place-items-center rounded-full transition hover:bg-muted"
        aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Notificaciones</p>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.link ?? "#"}
                className={cn(
                  "block border-b px-4 py-3 text-sm last:border-0 hover:bg-muted",
                  !item.read_at && "bg-primary-soft/50",
                )}
              >
                <p className="font-medium">{item.title}</p>
                {item.body && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{item.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
