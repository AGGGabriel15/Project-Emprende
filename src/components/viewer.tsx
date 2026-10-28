"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/types/domain";

const ViewerContext = createContext<{ role: Role | null }>({ role: null });

/** Rol de quien navega la tienda (null = visitante), para ocultar compras a vendedores y admins. */
export function ViewerProvider({ role, children }: { role: Role | null; children: React.ReactNode }) {
  return <ViewerContext.Provider value={{ role }}>{children}</ViewerContext.Provider>;
}

export function useViewerRole() {
  return useContext(ViewerContext).role;
}
