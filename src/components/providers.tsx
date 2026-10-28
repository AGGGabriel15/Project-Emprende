"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { Toaster } from "sonner";
import type { Geo } from "@/features/location/server";

const GeoContext = createContext<Geo>({ departments: [], municipalities: [] });

export function useGeo() {
  return useContext(GeoContext);
}

export function Providers({
  geo,
  children,
}: {
  geo: Geo;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <GeoContext.Provider value={geo}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: "font-sans" }}
        />
      </QueryClientProvider>
    </GeoContext.Provider>
  );
}
