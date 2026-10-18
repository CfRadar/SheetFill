import React, { useState } from "react";
import {
  Button,
  Chip,
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
  Sparkles,
  HelpCircle,
  FileText,
} from "lucide-react";
import { addSlots, generateWorkbook, getSession, downloadWorkbookFile } from "../api";
import { useAppStore } from "../store";
import { toast } from "../ui/ToastProvider";
import { FLIPKART_TSHIRT_PROMPT } from "../components/PromptDropdown";

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

  // Prompt View modal
  const {
    isOpen: isPromptModalOpen,
    onOpen: onOpenPromptModal,
    onOpenChange: onPromptModalChange,
  } = useDisclosure();

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

  // Detect output extension
  const isXls = filename?.toLowerCase().endsWith(".xls") && !filename?.toLowerCase().endsWith(".xlsm");
  const extLabel = isXls ? ".xls" : ".xlsm";

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

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(FLIPKART_TSHIRT_PROMPT);
      toast.success("ChatGPT Vision Prompt copied to clipboard!");
    } catch {
      toast.error("Failed to copy prompt.");
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
      <header className="sticky top-0 z-30 bg-content1/80 backdrop-blur-md border-b border-divider px-4 sm:px-6 py-2.5 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left section: Drawer toggle (mobile), Workbook chip, Slim progress indicator */}
          <div className="flex items-center gap-3 min-w-0">
            {onToggleMobileDrawer && (
              <Button
                size="sm"
                variant="flat"
                className="lg:hidden h-8 px-2.5 rounded-xl text-xs font-semibold"
                onPress={onToggleMobileDrawer}
                startContent={<Layers className="w-3.5 h-3.5 text-primary" />}
              >
                {totalCount} Designs
              </Button>
            )}

            <Chip
              variant="flat"
              color="default"
              size="sm"
              startContent={<FileSpreadsheet className="w-3.5 h-3.5 shrink-0 ml-1 text-primary" />}
              className="hidden sm:inline-flex h-8 text-xs font-semibold max-w-xs truncate border border-divider/80 bg-content2/60"
            >
              {filename}
            </Chip>

            {/* Slim progress bar & ready status */}
            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-divider/80">
              <div className="w-24 sm:w-32 h-1.5 rounded-full bg-default-100 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${percentReady}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                {readyCount} of {totalCount} ready
              </span>
            </div>
          </div>

          {/* Right section: Consolidated 1-Dominant Action + Grouped More Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Secondary Action: Paste all JSON */}
            <Button
              size="sm"
              variant="flat"
              color="default"
              startContent={<ClipboardPaste className="w-3.5 h-3.5 text-default-500" />}
              onPress={onOpenBulkPaste}
              className="h-9 px-3.5 rounded-xl font-medium text-xs text-foreground bg-content2/80 hover:bg-default-200 border border-divider/80 transition-colors hidden sm:inline-flex"
            >
              Paste all JSON
            </Button>

            {/* More Menu Dropdown (Groups Prompt, Add slots, New sheet) */}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  className="h-9 px-2.5 rounded-xl text-xs font-medium text-default-600 bg-content2/80 hover:bg-default-200 border border-divider/80"
                  startContent={<MoreHorizontal className="w-4 h-4 text-default-500" />}
                >
                  More
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="More workspace options" variant="flat">
                <DropdownItem
                  key="copy-prompt"
                  textValue="Copy ChatGPT Vision Prompt"
                  startContent={<FileText className="w-4 h-4 text-primary" />}
                  onPress={handleCopyPrompt}
                >
                  Copy Vision Prompt
                </DropdownItem>
                <DropdownItem
                  key="view-prompt"
                  textValue="View Listing Prompt"
                  startContent={<HelpCircle className="w-4 h-4 text-default-500" />}
                  onPress={onOpenPromptModal}
                >
                  View Vision Prompt
                </DropdownItem>
                <DropdownItem
                  key="add-slots"
                  textValue="Add design slots"
                  startContent={<Plus className="w-4 h-4 text-default-500" />}
                  onPress={() => setIsPopoverOpen(true)}
                >
                  Add Empty Slots
                </DropdownItem>
                <DropdownItem
                  key="paste-json-mobile"
                  className="sm:hidden"
                  textValue="Paste all JSON"
                  startContent={<ClipboardPaste className="w-4 h-4 text-default-500" />}
                  onPress={onOpenBulkPaste}
                >
                  Paste All JSON
                </DropdownItem>
                <DropdownItem
                  key="new-sheet"
                  textValue="Start new sheet"
                  startContent={<RotateCcw className="w-4 h-4 text-amber-500" />}
                  onPress={onOpenConfirm}
                >
                  New Sheet (Reset)
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            {/* Direct Download Action: Appears when generated */}
            {session.download_url && (
              <Button
                size="sm"
                color="success"
                variant="solid"
                isLoading={isDownloading}
                startContent={!isDownloading && <Download className="w-3.5 h-3.5" />}
                onPress={handleDirectDownload}
                className="h-9 px-3.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm"
              >
                {isDownloading ? "Downloading..." : `Download ${extLabel}`}
              </Button>
            )}

            {/* Dominant Primary Action: Generate .xlsm (Single High-Contrast Magnet Button) */}
            {readyCount === 0 ? (
              <Tooltip
                content={
                  needsCount > 0
                    ? `${needsCount} design${needsCount > 1 ? "s" : ""} pending valid JSON`
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
                    className="h-9 px-4 rounded-xl font-bold text-xs opacity-50 cursor-not-allowed"
                  >
                    Generate {extLabel}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                size="sm"
                color="primary"
                variant="solid"
                isLoading={isGenerating}
                startContent={!isGenerating && <Sparkles className="w-3.5 h-3.5 text-indigo-200" />}
                onPress={handleGenerate}
                className="h-9 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isGenerating ? "Generating..." : `Generate ${extLabel}`}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Add Slots Popover Dialog */}
      {isPopoverOpen && (
        <Modal isOpen={isPopoverOpen} onClose={() => setIsPopoverOpen(false)} size="xs">
          <ModalContent className="rounded-2xl border border-divider bg-content1 shadow-xl">
            <ModalHeader className="text-sm font-bold border-b border-divider py-3 px-5">
              Add Empty Design Slots
            </ModalHeader>
            <ModalBody className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  size="sm"
                  min={1}
                  max={summary?.room_for_new_designs || 20}
                  value={String(slotCount)}
                  onChange={(e) => setSlotCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                  aria-label="Slots count"
                />
                <Button
                  size="sm"
                  color="primary"
                  isLoading={isAdding}
                  onPress={handleAddSlots}
                  className="flex-1 font-bold rounded-xl h-9"
                >
                  Add Slots
                </Button>
              </div>
              <span className="text-[11px] text-default-400">
                Max {summary?.room_for_new_designs || 20} slots available in template
              </span>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Vision Prompt Modal */}
      <Modal isOpen={isPromptModalOpen} onOpenChange={onPromptModalChange} size="2xl" scrollBehavior="inside">
        <ModalContent className="rounded-2xl border border-divider bg-content1 shadow-2xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-bold border-b border-divider py-3.5 px-6 flex items-center justify-between">
                <span>Flipkart ChatGPT Vision Prompt</span>
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleCopyPrompt}
                  startContent={<FileText className="w-3.5 h-3.5" />}
                  className="rounded-xl font-semibold text-xs h-8 mr-6"
                >
                  Copy Prompt
                </Button>
              </ModalHeader>
              <ModalBody className="p-6">
                <pre className="text-xs font-mono bg-content2/60 p-4 rounded-xl border border-divider/60 whitespace-pre-wrap leading-relaxed select-text text-foreground">
                  {FLIPKART_TSHIRT_PROMPT}
                </pre>
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3 px-6">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* New Sheet Confirmation Modal */}
      <Modal isOpen={isConfirmOpen} onOpenChange={onConfirmChange} size="sm">
        <ModalContent className="rounded-2xl border border-divider bg-content1 shadow-2xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-bold border-b border-divider py-3.5 px-5">
                Start new sheet?
              </ModalHeader>
              <ModalBody className="text-sm text-default-600 p-5 leading-relaxed">
                Your current sheet designs and progress will be cleared from this workspace.
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3.5 px-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  className="rounded-xl font-medium"
                  onPress={() => {
                    onClose();
                    onNewSheet();
                  }}
                >
                  Start New
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
