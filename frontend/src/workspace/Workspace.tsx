import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/react";
import { StickyToolbar } from "./StickyToolbar";
import { DesignListSidebar } from "./DesignListSidebar";
import { DesignEditor } from "./DesignEditor";
import { BulkPasteDialog } from "../components/BulkPasteDialog";
import { GlobalBrandBar } from "../components/GlobalBrandBar";
import { ReportPanel } from "../components/ReportPanel";
import { EmptyState } from "../ui/EmptyState";
import { PageFade } from "../ui/PageFade";
import { useAppStore } from "../store";

interface WorkspaceProps {
  onNewSheet: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onNewSheet }) => {
  const { session, isBulkDialogOpen, setBulkDialogOpen } = useAppStore();
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{
    url: string;
    report: any;
    filename?: string;
  } | null>(null);
  const [isReportDismissed, setIsReportDismissed] = useState(false);

  // Initialize active design: select first incomplete or first design
  useEffect(() => {
    if (session && session.designs.length > 0) {
      if (!activeDesignId || !session.designs.some((d) => d.id === activeDesignId)) {
        const firstIncomplete = session.designs.find(
          (d) => d.status !== "ready" && d.status !== "complete"
        );
        setActiveDesignId(firstIncomplete ? firstIncomplete.id : session.designs[0].id);
      }
    }
  }, [session, activeDesignId]);

  // Sync downloadInfo from session if already generated (e.g. on load/refresh)
  useEffect(() => {
    if (session?.download_url && session?.report && !downloadInfo && !isReportDismissed) {
      setDownloadInfo({
        url: session.download_url,
        report: session.report,
        filename: session.output_filename || undefined,
      });
    } else if (!session?.download_url && !session?.output_filename && downloadInfo) {
      // Invalidate download panel when user modifies session data
      setDownloadInfo(null);
    }
  }, [session?.download_url, session?.report, session?.output_filename, isReportDismissed]);

  if (!session) return null;

  const { designs, design_sizes } = session;
  const activeIndex = designs.findIndex((d) => d.id === activeDesignId);
  const activeDesign = designs[activeIndex] || designs[0];

  const prevDesign = activeIndex > 0 ? designs[activeIndex - 1] : undefined;
  const nextDesign = activeIndex < designs.length - 1 ? designs[activeIndex + 1] : undefined;

  const handleSelectDesign = (id: string) => {
    setActiveDesignId(id);
    setIsMobileDrawerOpen(false);
  };

  const handleGenerated = (url: string, report: any, filename?: string) => {
    setIsReportDismissed(false);
    setDownloadInfo({ url, report, filename });
  };

  return (
    <PageFade className="flex flex-col min-h-[calc(100vh-56px)] bg-background text-foreground">
      {/* Sticky top workspace toolbar */}
      <StickyToolbar
        onOpenBulkPaste={() => setBulkDialogOpen(true)}
        onGenerated={handleGenerated}
        onNewSheet={onNewSheet}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* Generation Report Modal / Panel if available */}
      {downloadInfo && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <ReportPanel
            report={downloadInfo.report}
            downloadUrl={downloadInfo.url}
            filename={downloadInfo.filename}
            onReset={() => {
              setIsReportDismissed(true);
              setDownloadInfo(null);
            }}
          />
        </div>
      )}

      {/* Global Brand, Manufacturer & Packer Details Bar (On top, filled once) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
        <GlobalBrandBar sessionId={session.session_id} />
      </div>

      {/* Main Workspace Body: Container max-w-7xl with top spacing */}
      {designs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            title="No product designs detected"
            description="The uploaded sheet contains 0 data rows. Use '+ Add slots' in the toolbar to create design slots."
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex gap-6 items-start">
          {/* Desktop Left Sidebar: Fixed 320px list of designs */}
          <div className="hidden lg:block w-80 shrink-0 rounded-[14px] border border-divider bg-content1 shadow-sm overflow-hidden h-[calc(100vh-56px-53px-48px)] sticky top-[77px]">
            <DesignListSidebar
              designs={designs}
              activeDesignId={activeDesignId}
              onSelectDesign={handleSelectDesign}
              designSizes={design_sizes}
            />
          </div>

          {/* Right Panel: Active Design Editor aligned at top */}
          <main className="flex-1 min-w-0">
            {activeDesign ? (
              <DesignEditor
                key={activeDesign.id}
                design={activeDesign}
                index={activeIndex}
                total={designs.length}
                sessionId={session.session_id}
                onSelectDesign={handleSelectDesign}
                prevDesignId={prevDesign?.id}
                nextDesignId={nextDesign?.id}
              />
            ) : (
              <EmptyState title="Select a design" description="Choose a design from the list to start editing." />
            )}
          </main>
        </div>
      )}

      {/* Mobile Design Selection Drawer (< 1024px) */}
      <Drawer
        isOpen={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        placement="left"
        size="sm"
      >
        <DrawerContent className="rounded-r-[14px] bg-content1 border-r border-divider">
          {() => (
            <>
              <DrawerHeader className="border-b border-divider text-base font-semibold py-3 px-4">
                Designs ({designs.length})
              </DrawerHeader>
              <DrawerBody className="p-0">
                <DesignListSidebar
                  designs={designs}
                  activeDesignId={activeDesignId}
                  onSelectDesign={handleSelectDesign}
                  designSizes={design_sizes}
                />
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Bulk Paste JSON Dialog */}
      <BulkPasteDialog
        isOpen={isBulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
      />
    </PageFade>
  );
};
