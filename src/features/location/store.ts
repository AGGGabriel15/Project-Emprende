"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const LOCATION_COOKIE = "cm_loc";

type LocationState = {
  departmentId: number | null;
  municipalityId: number | null;
  /** El visitante cerró el diálogo sin elegir: no se vuelve a abrir solo. */
  promptDismissed: boolean;
  setLocation: (departmentId: number, municipalityId: number) => void;
  dismissPrompt: () => void;
};

function writeCookie(departmentId: number, municipalityId: number) {
  document.cookie = `${LOCATION_COOKIE}=${departmentId}:${municipalityId}; path=/; max-age=31536000; samesite=lax`;
}

/** Ubicación del visitante: localStorage + cookie para que el servidor la lea. */
export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      departmentId: null,
      municipalityId: null,
      promptDismissed: false,
      setLocation: (departmentId, municipalityId) => {
        writeCookie(departmentId, municipalityId);
        set({ departmentId, municipalityId });
      },
      dismissPrompt: () => set({ promptDismissed: true }),
    }),
    {
      name: "cm-location",
      onRehydrateStorage: () => (state) => {
        if (state?.departmentId && state.municipalityId) {
          writeCookie(state.departmentId, state.municipalityId);
        }
      },
    },
  ),
);
