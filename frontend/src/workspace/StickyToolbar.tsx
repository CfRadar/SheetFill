import React, { useState } from "react";
import {
  Button,
  Chip,
  Progress,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
} from "@heroui/react";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Plus,
  Download,
  RotateCcw,
  MoreHorizontal,
  Layers,
} from "lucide-react";
import { addSlots, generateWorkbook, getSession, downloadWorkbookFile } from "../api";
import { useAppStore } from "../store";
import { PromptDropdown } from "../components/PromptDropdown";
import { toast } from "../ui/ToastProvider";

interface StickyToolbarProps {
  onOpenBulkPaste: () => void;
  onGenerated: (downloadUrl: string, report: any, filename?: string) => void;
  onNewSheet: () => void;
  onToggleMobileDrawer?: () => void;
}

export const StickyToolbar: React.FC<StickyToolbarProps> = ({
  onOpenBulkPaste,
  onGenerated,
  onNewSheet,
  onToggleMobileDrawer,
}) => {
  const { session, setSession, setError } = useAppStore();
  const [slotCount, setSlotCount] = useState<number>(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // New Sheet confirmation modal
  const {
    isOpen: isConfirmOpen,
    onOpen: onOpenConfirm,
    onOpenChange: onConfirmChange,
  } = useDisclosure();

  if (!session) return null;

  const { designs, summary, filename } = session;
  const readyCount = designs.filter(
    (d) => d.status === "ready" || d.status === "complete"
  ).length;
  const totalCount = designs.length;
  const needsCount = totalCount - readyCount;
  const percentReady = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  const handleAddSlots = async () => {
    if (slotCount < 1) return;
    try {
      setIsAdding(true);
      const updated = await addSlots(session.session_id, slotCount);
      setSession(updated);
      toast.success(`Added ${slotCount} new design slot${slotCount > 1 ? "s" : ""}.`);
      setIsPopoverOpen(false);
      setSlotCount(1);
    } catch (err: any) {
      setError(err?.message || "Failed to add slots");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDirectDownload = async () => {
    const url = session?.download_url;
    if (!url || isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadWorkbookFile(url, session.output_filename || undefined);
      toast.success("Workbook downloaded successfully!");
    } catch (err: any) {
      console.error("Direct download error:", err);
      toast.error(err?.message || "Failed to download workbook");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerate = async () => {
    if (readyCount === 0 || isGenerating) return;
    try {
      setIsGenerating(true);
      setError(null);
      const res = await generateWorkbook(session.session_id, "ready_only");

      // Sync session in store with refreshed state
      try {
        const refreshed = await getSession(session.session_id);
        setSession(refreshed);
      } catch {
        setSession({
          ...session,
          download_url: res.download_url,
          output_filename: res.filename,
          report: res.report,
        });
      }

      toast.success("Workbook generated successfully!", "Download ready");
      onGenerated(res.download_url, res.report, res.filename);

      // Trigger automatic file download
      try {
        await downloadWorkbookFile(res.download_url, res.filename);
      } catch (dlErr: any) {
        console.warn("Auto-download trigger failed (browser may require manual click):", dlErr);
      }
    } catch (err: any) {
      setError(err?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-content1 border-b border-divider px-4 sm:px-6 py-2 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left section: Drawer toggle (mobile), Workbook chip, ready progress */}
          <div className="flex items-center gap-3 min-w-0">
            {onToggleMobileDrawer && (
              <Button
                size="sm"
                variant="flat"
                className="lg:hidden h-9 px-3 rounded-[10px] text-xs font-medium"
                onPress={onToggleMobileDrawer}
                startContent={<Layers className="w-3.5 h-3.5 text-primary" />}
              >
                Designs ({totalCount})
              </Button>
            )}

            <Chip
              variant="flat"
              color="default"
              size="sm"
              startContent={<FileSpreadsheet className="w-3.5 h-3.5 shrink-0 ml-1 text-primary" />}
              className="hidden sm:inline-flex h-7 text-xs font-medium max-w-xs truncate border border-divider"
            >
              {filename}
            </Chip>

            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-divider">
              <span className="text-xs font-medium text-default-600 whitespace-nowrap">
                {readyCount} of {totalCount} ready
              </span>
              <div className="w-40 h-1 bg-default-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${percentReady}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right section: Toolbar actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop Actions (>= 1024px) */}
            <div className="hidden lg:flex items-center gap-2">
              {/* Secondary button: Paste all JSON */}
              <Button
                size="sm"
                variant="flat"
                color="default"
                startContent={<ClipboardPaste className="w-3.5 h-3.5 text-default-500" />}
                onPress={onOpenBulkPaste}
                className="h-9 px-3.5 rounded-[10px] font-medium text-xs text-foreground bg-content3 hover:bg-default-200 border border-divider transition-colors"
              >
                Paste all JSON
              </Button>

              {/* Secondary button: Prompt */}
              <PromptDropdown />

              {/* Ghost button: Add slots Popover */}
              <Popover
                isOpen={isPopoverOpen}
                onOpenChange={setIsPopoverOpen}
                placement="bottom-end"
                showArrow
              >
                <PopoverTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    startContent={<Plus className="w-3.5 h-3.5 text-default-500" />}
                    className="h-9 px-3 rounded-[10px] font-medium text-xs text-default-600 hover:text-foreground"
                  >
                    Add slots
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-3 w-56 rounded-[14px] border border-divider bg-content1 shadow-lg">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Add empty design slots
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        size="sm"
                        min={1}
                        max={summary?.room_for_new_designs || 20}
                        value={String(slotCount)}
                        onChange={(e) => setSlotCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20"
                        aria-label="Slots count"
                      />
                      <Button
                        size="sm"
                        color="primary"
                        isLoading={isAdding}
                        onPress={handleAddSlots}
                        className="flex-1 font-medium rounded-[10px]"
                      >
                        Add
                      </Button>
                    </div>
                    <span className="text-[11px] text-default-400">
                      Max {summary?.room_for_new_designs || 20} slots available
                    </span>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Ghost button: New sheet */}
              <Button
                size="sm"
                variant="light"
                startContent={<RotateCcw className="w-3.5 h-3.5 text-default-500" />}
                onPress={onOpenConfirm}
                className="h-9 px-3 rounded-[10px] font-medium text-xs text-default-600 hover:text-foreground"
              >
                New sheet
              </Button>
            </div>

            {/* Mobile / Tablet (< 1024px) More Dropdown */}
            <div className="lg:hidden flex items-center">
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="flat"
                    color="default"
                    isIconOnly
                    className="h-9 w-9 rounded-[10px] text-default-700 bg-content3 border border-divider"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                {session.download_url ? (
                  <DropdownMenu aria-label="Toolbar options" variant="flat">
                    <DropdownItem
                      key="download-xls"
                      startContent={<Download className="w-4 h-4 text-emerald-500" />}
                      onPress={handleDirectDownload}
                    >
                      Download .xls
                    </DropdownItem>
                    <DropdownItem
                      key="paste-json"
                      startContent={<ClipboardPaste className="w-4 h-4 text-default-500" />}
                      onPress={onOpenBulkPaste}
                    >
                      Paste all JSON
                    </DropdownItem>
                    <DropdownItem
                      key="add-slots"
                      startContent={<Plus className="w-4 h-4 text-default-500" />}
                      onPress={() => setIsPopoverOpen(true)}
                    >
                      Add slots
                    </DropdownItem>
                    <DropdownItem
                      key="new-sheet"
                      startContent={<RotateCcw className="w-4 h-4 text-default-500" />}
                      onPress={onOpenConfirm}
                    >
                      New sheet
                    </DropdownItem>
                  </DropdownMenu>
                ) : (
                  <DropdownMenu aria-label="Toolbar options" variant="flat">
                    <DropdownItem
                      key="paste-json"
                      startContent={<ClipboardPaste className="w-4 h-4 text-default-500" />}
                      onPress={onOpenBulkPaste}
                    >
                      Paste all JSON
                    </DropdownItem>
                    <DropdownItem
                      key="add-slots"
                      startContent={<Plus className="w-4 h-4 text-default-500" />}
                      onPress={() => setIsPopoverOpen(true)}
                    >
                      Add slots
                    </DropdownItem>
                    <DropdownItem
                      key="new-sheet"
                      startContent={<RotateCcw className="w-4 h-4 text-default-500" />}
                      onPress={onOpenConfirm}
                    >
                      New sheet
                    </DropdownItem>
                  </DropdownMenu>
                )}
              </Dropdown>
            </div>

            {/* Direct Download Action: Appears whenever workbook is generated */}
            {session.download_url && (
              <Button
                size="sm"
                color="success"
                variant="solid"
                isLoading={isDownloading}
                startContent={!isDownloading && <Download className="w-3.5 h-3.5" />}
                onPress={handleDirectDownload}
                className="h-9 px-3.5 rounded-[10px] font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs"
              >
                {isDownloading ? "Downloading..." : "Download .xls"}
              </Button>
            )}

            {/* Dominant Primary Action: Generate .xls (ALWAYS visible) */}
            {readyCount === 0 ? (
              <Tooltip
                content={
                  needsCount > 0
                    ? `${needsCount} design${needsCount > 1 ? "s" : ""} still need valid JSON`
                    : "No designs ready to generate"
                }
                placement="bottom-end"
                delay={150}
              >
                <span>
                  <Button
                    size="sm"
                    color="primary"
                    variant="solid"
                    isDisabled
                    startContent={<FileSpreadsheet className="w-3.5 h-3.5" />}
                    className="h-9 px-3.5 rounded-[10px] font-semibold text-xs opacity-50 cursor-not-allowed"
                  >
                    Generate .xls
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                size="sm"
                color="primary"
                variant="solid"
                isLoading={isGenerating}
                startContent={!isGenerating && <FileSpreadsheet className="w-3.5 h-3.5" />}
                onPress={handleGenerate}
                className="h-9 px-4 rounded-[10px] font-semibold text-xs text-white shadow-xs"
              >
                {isGenerating ? "Generating..." : "Generate .xls"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* New Sheet Confirmation Modal */}
      <Modal isOpen={isConfirmOpen} onOpenChange={onConfirmChange} size="sm">
        <ModalContent className="rounded-[14px] border border-divider bg-content1 shadow-xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-semibold border-b border-divider py-3 px-5">
                Start new sheet?
              </ModalHeader>
              <ModalBody className="text-sm text-default-600 p-5">
                Your current sheet progress and designs will be cleared from this browser session.
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3 px-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-[10px]">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  className="rounded-[10px] font-medium"
                  onPress={() => {
                    onClose();
                    onNewSheet();
                  }}
                >
                  Start new
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
