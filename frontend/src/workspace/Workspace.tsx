import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/react";
import { StickyToolbar } from "./StickyToolbar";
import { DesignListSidebar } from "./DesignListSidebar";
import { DesignEditor } from "./DesignEditor";
import { BulkPasteDialog } from "../components/BulkPasteDialog";
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
    setDownloadInfo({ url, report, filename });
  };

  return (
    <PageFade className="flex flex-col min-h-[calc(100vh-56px)] bg-background">
      {/* Sticky top workspace toolbar */}
      <StickyToolbar
        onOpenBulkPaste={() => setBulkDialogOpen(true)}
        onGenerated={handleGenerated}
        onNewSheet={onNewSheet}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* Generation Report Modal / Panel if available */}
      {downloadInfo && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <ReportPanel
            report={downloadInfo.report}
            downloadUrl={downloadInfo.url}
            filename={downloadInfo.filename}
            onReset={() => setDownloadInfo(null)}
          />
        </div>
      )}

      {/* Main Workspace Body */}
      {designs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            title="No product designs detected"
            description="The uploaded sheet contains 0 data rows. Use '+ Add slots' in the toolbar to create design slots."
          />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Left Sidebar: Fixed 320px list of designs */}
          <div className="hidden lg:block h-[calc(100vh-56px-53px)] sticky top-[53px]">
            <DesignListSidebar
              designs={designs}
              activeDesignId={activeDesignId}
              onSelectDesign={handleSelectDesign}
              designSizes={design_sizes}
            />
          </div>

          {/* Right Panel: Active Design Editor */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
        <DrawerContent>
          {() => (
            <>
              <DrawerHeader className="border-b border-divider text-base font-semibold">
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
