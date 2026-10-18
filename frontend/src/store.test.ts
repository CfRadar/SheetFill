import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, DEFAULT_BRIEF } from "./store";

describe("useAppStore & State Persistence", () => {
  beforeEach(() => {
    useAppStore.getState().resetAllWorkspaces();
  });

  it("manages session, loading, and error states", () => {
    expect(useAppStore.getState().session).toBeNull();
    expect(useAppStore.getState().loading).toBe(false);

    useAppStore.getState().setLoading(true);
    expect(useAppStore.getState().loading).toBe(true);

    useAppStore.getState().setError("Invalid workbook format");
    expect(useAppStore.getState().error).toBe("Invalid workbook format");

    useAppStore.getState().setError(null);
    expect(useAppStore.getState().error).toBeNull();
  });

  it("handles dialog and design expansion toggling", () => {
    useAppStore.getState().setBulkDialogOpen(true);
    expect(useAppStore.getState().isBulkDialogOpen).toBe(true);

    useAppStore.getState().toggleDesignExpanded("d1");
    expect(useAppStore.getState().expandedDesigns["d1"]).toBe(true);

    useAppStore.getState().toggleDesignExpanded("d1");
    expect(useAppStore.getState().expandedDesigns["d1"]).toBe(false);

    useAppStore.getState().setDesignExpanded("d2", true);
    expect(useAppStore.getState().expandedDesigns["d2"]).toBe(true);
  });

  it("preserves state when switching tabs back and forth", () => {
    // 1. Populate Sheet Filler state
    const mockSession: any = {
      session_id: "test_sid_123",
      filename: "Flipkart_Catalog.xlsm",
      designs: [
        { id: "des_1", title: "Oversized Tee", status: "pending", sizes_found: ["S", "M"] },
        { id: "des_2", title: "Polo Tee", status: "ready", sizes_found: ["L", "XL"] },
      ],
      design_sizes: { des_1: ["S", "M"] },
      design_raw_text: { des_1: '{"product_title": "Oversized Tee"}' },
      design_jsons: { des_1: { product_title: "Oversized Tee" } },
      brand_meta: { brand: "UrbanStyle", mrp: 1999 },
    };

    useAppStore.getState().setSession(mockSession);
    expect(useAppStore.getState().session?.session_id).toBe("test_sid_123");
    expect(useAppStore.getState().activeDesignId).toBe("des_1");

    // 2. Switch to Keyword Agent tab
    useAppStore.getState().setActiveSection("keyword-agent");
    expect(useAppStore.getState().activeSection).toBe("keyword-agent");

    // 3. Edit Keyword Agent brief and state
    useAppStore.getState().updateBrief({ color: "Olive Green", tshirt_type: "Graphic Hooded Tee" });
    useAppStore.getState().setKeywordAgentState({
      currentRunId: "run_888",
      runStatus: "running",
      currentStage: "marketplace",
    });

    // 4. Switch back to Sheet Filler tab
    useAppStore.getState().setActiveSection("sheets");
    expect(useAppStore.getState().activeSection).toBe("sheets");

    // Assert: Sheet designs, session ID, and active design remain 100% intact
    expect(useAppStore.getState().session?.session_id).toBe("test_sid_123");
    expect(useAppStore.getState().session?.designs.length).toBe(2);
    expect(useAppStore.getState().activeDesignId).toBe("des_1");

    // 5. Switch back to Keyword Agent tab
    useAppStore.getState().setActiveSection("keyword-agent");

    // Assert: Keyword brief, runId, and status remain 100% intact
    expect(useAppStore.getState().brief.color).toBe("Olive Green");
    expect(useAppStore.getState().brief.tshirt_type).toBe("Graphic Hooded Tee");
    expect(useAppStore.getState().currentRunId).toBe("run_888");
    expect(useAppStore.getState().runStatus).toBe("running");
  });

  it("supports isolated reset per slice without wiping other tab data", () => {
    // Populate both tabs
    useAppStore.getState().setSession({
      session_id: "sheet_999",
      filename: "Sheet.xlsm",
      designs: [],
      design_sizes: {},
      design_raw_text: {},
      design_jsons: {},
      brand_meta: {},
    } as any);

    useAppStore.getState().updateBrief({ color: "Maroon" });
    useAppStore.getState().setKeywordAgentState({ currentRunId: "kw_777" });

    // Reset ONLY Sheet Filler
    useAppStore.getState().resetSheetFiller();
    expect(useAppStore.getState().session).toBeNull();

    // Keyword Agent must remain completely untouched!
    expect(useAppStore.getState().brief.color).toBe("Maroon");
    expect(useAppStore.getState().currentRunId).toBe("kw_777");

    // Now re-add a session and reset ONLY Keyword Agent
    useAppStore.getState().setSession({ session_id: "sheet_again" } as any);
    useAppStore.getState().resetKeywordAgent();

    // Sheet Filler must remain untouched!
    expect(useAppStore.getState().session?.session_id).toBe("sheet_again");
    // Keyword Agent reset to defaults
    expect(useAppStore.getState().brief.color).toBe(DEFAULT_BRIEF.color);
    expect(useAppStore.getState().currentRunId).toBeNull();
  });

  it("clears everything when resetAllWorkspaces is triggered", () => {
    useAppStore.getState().setSession({ session_id: "sheet_all" } as any);
    useAppStore.getState().updateBrief({ color: "Purple" });

    useAppStore.getState().resetAllWorkspaces();

    expect(useAppStore.getState().session).toBeNull();
    expect(useAppStore.getState().brief.color).toBe(DEFAULT_BRIEF.color);
    expect(useAppStore.getState().currentRunId).toBeNull();
  });
});
