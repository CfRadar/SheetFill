import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("appStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      session: null,
      loading: false,
      error: null,
      expandedDesigns: {},
      isBulkDialogOpen: false,
    });
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
});
