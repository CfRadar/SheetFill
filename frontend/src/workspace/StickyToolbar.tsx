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
  useDisclosure,
} from "@heroui/react";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Plus,
  Download,
  RotateCcw,
} from "lucide-react";
import { addSlots, generateWorkbook } from "../api";
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

  const handleGenerate = async () => {
    if (readyCount === 0 || isGenerating) return;
    try {
      setIsGenerating(true);
      setError(null);
      const res = await generateWorkbook(session.session_id, "ready_only");
      toast.success("Workbook generated successfully!", "Download ready");
      onGenerated(res.download_url, res.report, res.filename);
    } catch (err: any) {
      setError(err?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-content1/95 backdrop-blur-md border-b border-divider px-4 py-2.5 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Workbook chip, design count & progress */}
          <div className="flex items-center gap-3">
            {onToggleMobileDrawer && (
              <Button
                size="sm"
                variant="flat"
                className="lg:hidden"
                onPress={onToggleMobileDrawer}
              >
                Designs ({totalCount})
              </Button>
            )}

            <Chip
              variant="flat"
              color="default"
              size="sm"
              startContent={<FileSpreadsheet className="w-3.5 h-3.5 shrink-0 ml-1 text-primary" />}
              className="max-w-[180px] sm:max-w-xs font-medium truncate"
            >
              {filename}
            </Chip>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-divider">
              <Progress
                size="sm"
                value={percentReady}
                color={readyCount === totalCount ? "success" : "primary"}
                aria-label="Design readiness progress"
                className="w-24 md:w-32"
              />
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                {readyCount} of {totalCount} ready
              </span>
            </div>
          </div>

          {/* Right: Actions & Primary Generate Button */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<ClipboardPaste className="w-3.5 h-3.5" />}
              onPress={onOpenBulkPaste}
              className="font-medium"
            >
              Paste all JSON
            </Button>

            <PromptDropdown />

            {/* Add Slots Popover */}
            <Popover
              isOpen={isPopoverOpen}
              onOpenChange={setIsPopoverOpen}
              placement="bottom-end"
              showArrow
            >
              <PopoverTrigger>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus className="w-3.5 h-3.5" />}
                  className="font-medium"
                >
                  Add slots
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-3 w-56">
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
                      className="flex-1 font-medium"
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

            {/* New Sheet Confirmation */}
            <Button
              size="sm"
              variant="light"
              color="default"
              startContent={<RotateCcw className="w-3.5 h-3.5" />}
              onPress={onOpenConfirm}
              className="text-default-600 hover:text-foreground font-medium"
            >
              New sheet
            </Button>

            {/* Primary Generate Action */}
            {readyCount === 0 ? (
              <Tooltip
                content={
                  needsCount > 0
                    ? `${needsCount} design${needsCount > 1 ? "s" : ""} still need valid JSON`
                    : "No designs ready to generate"
                }
                placement="bottom"
                delay={150}
              >
                <span>
                  <Button
                    size="sm"
                    color="success"
                    isDisabled
                    startContent={<Download className="w-3.5 h-3.5" />}
                    className="font-bold opacity-50 cursor-not-allowed"
                  >
                    Generate .xls
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                size="sm"
                color="success"
                isLoading={isGenerating}
                startContent={!isGenerating && <Download className="w-3.5 h-3.5" />}
                onPress={handleGenerate}
                className="font-bold text-white shadow-sm"
              >
                {isGenerating ? "Generating..." : "Generate .xls"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* New Sheet Confirmation Modal */}
      <Modal isOpen={isConfirmOpen} onOpenChange={onConfirmChange} size="sm">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-semibold">Start new sheet?</ModalHeader>
              <ModalBody className="text-sm text-default-600">
                Your current sheet progress and designs will be cleared from this browser session.
              </ModalBody>
              <ModalFooter>
                <Button size="sm" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
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
