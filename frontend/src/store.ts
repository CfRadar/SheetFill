import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./store/idbStorage";
import type { SessionState } from "./types";
import type { ProductBrief, RunResult, SSEEvent } from "./features/keyword-agent/types";

export const DEFAULT_BRIEF: ProductBrief = {
  platforms: ["amazon", "flipkart", "myntra", "meesho"],
  tshirt_type: "Oversized T-Shirt",
  color: "Black",
  gender: "men",
  fit: "Oversized",
  fabric: "100% Cotton",
  neck: "Round Neck",
  sleeve: "Half Sleeve",
  pattern: "Graphic Print",
  brand_name: "UrbanStyle",
  pack: "Single",
  price_min: 599,
  price_max: 999,
  extra_details: "Streetwear aesthetic with anime back print, heavyweight 240 GSM drop shoulder",
  research_sources: ["amazon", "flipkart", "myntra", "meesho", "google", "reddit"],
};

export interface SheetFillerSlice {
  session: SessionState | null;
  activeDesignId: string | null;
  filterMode: "all" | "needs_info" | "ready";
  expandedDesigns: Record<string, boolean>;
  isBulkDialogOpen: boolean;
}

export interface KeywordAgentSlice {
  brief: ProductBrief;
  currentRunId: string | null;
  runStatus: "idle" | "running" | "success" | "error" | "cancelled";
  currentStage: SSEEvent["stage"] | null;
  events: SSEEvent[];
  result: RunResult | null;
  errorMsg: string | null;
}

export interface AppState extends SheetFillerSlice, KeywordAgentSlice {
  // Navigation & Shared UI
  activeSection: "sheets" | "keyword-agent" | "admin";
  loading: boolean;
  error: string | null;

  // Actions - Shared / Navigation
  setActiveSection: (section: "sheets" | "keyword-agent" | "admin") => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Sheet Filler
  setSession: (session: SessionState | null) => void;
  setActiveDesignId: (id: string | null) => void;
  setFilterMode: (mode: "all" | "needs_info" | "ready") => void;
  toggleDesignExpanded: (designId: string) => void;
  setDesignExpanded: (designId: string, expanded: boolean) => void;
  setBulkDialogOpen: (open: boolean) => void;
  resetSheetFiller: () => void;

  // Actions - Keyword Agent
  updateBrief: (partial: Partial<ProductBrief>) => void;
  setKeywordAgentState: (partial: Partial<KeywordAgentSlice>) => void;
  appendKeywordEvent: (event: SSEEvent) => void;
  resetKeywordAgent: () => void;

  // Actions - Global
  resetAllWorkspaces: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Shared / Navigation Defaults
      activeSection: "sheets",
      loading: false,
      error: null,

      // Sheet Filler Defaults
      session: null,
      activeDesignId: null,
      filterMode: "all",
      expandedDesigns: {},
      isBulkDialogOpen: false,

      // Keyword Agent Defaults
      brief: DEFAULT_BRIEF,
      currentRunId: null,
      runStatus: "idle",
      currentStage: null,
      events: [],
      result: null,
      errorMsg: null,

      // Shared Actions
      setActiveSection: (activeSection) => set({ activeSection }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Sheet Filler Actions
      setSession: (session) =>
        set((state) => {
          let nextActiveId = state.activeDesignId;
          const sanitizedSession = session
            ? {
                ...session,
                design_sizes: session.design_sizes || {},
                design_raw_text: session.design_raw_text || {},
                design_jsons: session.design_jsons || {},
                design_image_edits: session.design_image_edits || {},
                design_product_links: session.design_product_links || {},
                design_meta: session.design_meta || {},
              }
            : null;

          if (sanitizedSession && sanitizedSession.designs && sanitizedSession.designs.length > 0) {
            if (!nextActiveId || !sanitizedSession.designs.some((d) => d.id === nextActiveId)) {
              const firstIncomplete = sanitizedSession.designs.find(
                (d) => d.status !== "ready" && d.status !== "complete"
              );
              nextActiveId = firstIncomplete ? firstIncomplete.id : sanitizedSession.designs[0].id;
            }
          } else if (!sanitizedSession) {
            nextActiveId = null;
          }
          return { session: sanitizedSession, activeDesignId: nextActiveId };
        }),

      setActiveDesignId: (activeDesignId) => set({ activeDesignId }),
      setFilterMode: (filterMode) => set({ filterMode }),
      toggleDesignExpanded: (designId) =>
        set((state) => {
          const current = state.expandedDesigns || {};
          return {
            expandedDesigns: {
              ...current,
              [designId]: !current[designId],
            },
          };
        }),
      setDesignExpanded: (designId, expanded) =>
        set((state) => {
          const current = state.expandedDesigns || {};
          return {
            expandedDesigns: {
              ...current,
              [designId]: expanded,
            },
          };
        }),
      setBulkDialogOpen: (open) => set({ isBulkDialogOpen: open }),
      resetSheetFiller: () =>
        set({
          session: null,
          activeDesignId: null,
          filterMode: "all",
          expandedDesigns: {},
          isBulkDialogOpen: false,
        }),

      // Keyword Agent Actions
      updateBrief: (partial) =>
        set((state) => ({
          brief: { ...state.brief, ...partial },
        })),

      setKeywordAgentState: (partial) => set(partial),

      appendKeywordEvent: (event) =>
        set((state) => ({
          events: [...state.events, event],
          currentStage: event.stage || state.currentStage,
        })),

      resetKeywordAgent: () =>
        set({
          brief: DEFAULT_BRIEF,
          currentRunId: null,
          runStatus: "idle",
          currentStage: null,
          events: [],
          result: null,
          errorMsg: null,
        }),

      // Global Reset
      resetAllWorkspaces: () =>
        set({
          session: null,
          activeDesignId: null,
          filterMode: "all",
          expandedDesigns: {},
          isBulkDialogOpen: false,
          brief: DEFAULT_BRIEF,
          currentRunId: null,
          runStatus: "idle",
          currentStage: null,
          events: [],
          result: null,
          errorMsg: null,
        }),
    }),
    {
      name: "sheetfill_workspace_store",
      storage: createJSONStorage(() => idbStorage),
      version: 2,
      migrate: (persistedState: any, _version: number) => {
        const state = persistedState || {};
        return {
          ...state,
          brief: state.brief || DEFAULT_BRIEF,
          runStatus: state.runStatus || "idle",
          events: state.events || [],
          filterMode: state.filterMode || "all",
          expandedDesigns: state.expandedDesigns || {},
          session: state.session
            ? {
                ...state.session,
                design_sizes: state.session.design_sizes || {},
                design_raw_text: state.session.design_raw_text || {},
                design_jsons: state.session.design_jsons || {},
                design_image_edits: state.session.design_image_edits || {},
                design_product_links: state.session.design_product_links || {},
                design_meta: state.session.design_meta || {},
              }
            : null,
        };
      },
      partialize: (state) => ({
        // Persist only workspace data; omit transient runtime flags like loading and error
        activeSection: state.activeSection,
        session: state.session,
        activeDesignId: state.activeDesignId,
        filterMode: state.filterMode || "all",
        expandedDesigns: state.expandedDesigns || {},
        brief: state.brief,
        currentRunId: state.currentRunId,
        runStatus: state.runStatus,
        currentStage: state.currentStage,
        events: state.events,
        result: state.result,
      }),
    }
  )
);
