import { create } from "zustand";
import { SessionState } from "./types";

interface AppState {
  session: SessionState | null;
  loading: boolean;
  error: string | null;
  expandedDesigns: Record<string, boolean>;
  isBulkDialogOpen: boolean;
  setSession: (session: SessionState | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleDesignExpanded: (designId: string) => void;
  setDesignExpanded: (designId: string, expanded: boolean) => void;
  setBulkDialogOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  loading: false,
  error: null,
  expandedDesigns: {},
  isBulkDialogOpen: false,
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  toggleDesignExpanded: (designId) =>
    set((state) => ({
      expandedDesigns: {
        ...state.expandedDesigns,
        [designId]: !state.expandedDesigns[designId],
      },
    })),
  setDesignExpanded: (designId, expanded) =>
    set((state) => ({
      expandedDesigns: {
        ...state.expandedDesigns,
        [designId]: expanded,
      },
    })),
  setBulkDialogOpen: (open) => set({ isBulkDialogOpen: open }),
}));
