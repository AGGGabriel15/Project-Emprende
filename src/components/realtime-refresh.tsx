"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createRealtimeClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

/**
 * Escucha cambios de una tabla (Supabase Realtime respeta RLS) y refresca los
 * Server Components de la página. `onChange` permite reaccionar además (toast, sonido).
 */
export function RealtimeRefresh({
  channel,
  table,
  filter,
  onChange,
}: {
  channel: string;
  table: "orders" | "notifications" | "shipments";
  filter?: string;
  onChange?: (payload: RealtimePostgresChangesPayload<Row>) => void;
}) {
  const router = useRouter();
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let cleanup = () => {};
    void createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const subscription = supabase
        // Nombre único: dos componentes con el mismo canal comparten instancia y fallan.
        .channel(`${channel}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload: RealtimePostgresChangesPayload<Row>) => {
            handler.current?.(payload);
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 250);
          },
        )
        .subscribe();
      cleanup = () => void supabase.removeChannel(subscription);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanup();
    };
  }, [channel, table, filter, router]);

  return null;
}
