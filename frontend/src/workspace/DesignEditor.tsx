import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Tag,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { deleteDesign, saveDesignImages, saveDesignSizes, saveDesignJson } from "../api";
import { useAppStore } from "../store";
import { DetectedDesign, PreviewRow } from "../types";
import { StatusChip } from "../ui/StatusChip";
import { JsonEditor } from "../components/JsonEditor";
import { ImageLinksEditor } from "../components/ImageLinksEditor";
import { RowsPreview } from "../components/RowsPreview";
import { toast } from "../ui/ToastProvider";
import { resolveDesignSizes } from "../utils/designUtils";

interface DesignEditorProps {
  design: DetectedDesign;
  index: number;
  total: number;
  sessionId: string;
  onSelectDesign: (id: string) => void;
  prevDesignId?: string;
  nextDesignId?: string;
}

const BRAND_SIZES = ["S", "M", "L", "XL", "XS", "XXL", "3XL", "4XL", "5XL", "Free"];

export const DesignEditor: React.FC<DesignEditorProps> = ({
  design,
  index,
  total,
  sessionId,
  onSelectDesign,
  prevDesignId,
  nextDesignId,
}) => {
  const { session, setSession, setError } = useAppStore();

  const [sizes, setSizes] = useState<string[]>(() =>
    resolveDesignSizes(session?.design_sizes[design.id], design.sizes_found)
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete modal disclosure
  const {
    isOpen: isDeleteOpen,
    onOpen: onOpenDelete,
    onOpenChange: onDeleteChange,
  } = useDisclosure();

  const initialJsonText = session?.design_raw_text[design.id] || "";

  // Keep sizes local state in sync when active design changes
  useEffect(() => {
    setSizes(resolveDesignSizes(session?.design_sizes[design.id], design.sizes_found));
  }, [design.id, session?.design_sizes]);

  // Load preview rows if json already present and previewRows is currently empty
  useEffect(() => {
    let isMounted = true;
    if (session && session.design_jsons[design.id]) {
      const currentRaw = session.design_raw_text[design.id];
      if (currentRaw && currentRaw.trim()) {
        saveDesignJson(session.session_id, design.id, currentRaw)
          .then((res) => {
            if (isMounted && res?.preview_rows?.length) {
              setPreviewRows(res.preview_rows);
            }
          })
          .catch(() => {});
      }
    }
    return () => {
      isMounted = false;
    };
  }, [design.id, session?.session_id]);

  const handleToggleSize = async (size: string) => {
    const next = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size];
    if (next.length === 0) return; // Minimum 1 size required
    setSizes(next);
    if (session) {
      try {
        const res = await saveDesignSizes(session.session_id, design.id, next);
        if (res?.preview_rows && res.preview_rows.length > 0) {
          setPreviewRows(res.preview_rows);
        }
        if (res?.design) {
          design.status = res.design.status;
        }
        setSession({
          ...session,
          design_sizes: {
            ...session.design_sizes,
            [design.id]: next,
          },
        });
      } catch (err: any) {
        setError(err?.message || "Failed to update sizes");
      }
    }
  };

  const handleSaveImages = async (
    urls: (string | null)[],
    productLink?: string | null,
    unlock: boolean = false
  ) => {
    if (session) {
      await saveDesignImages(session.session_id, design.id, urls, productLink, unlock);
    }
  };

  const handleDelete = async (onCloseModal: () => void) => {
    if (!session) return;
    try {
      setIsDeleting(true);
      const updated = await deleteDesign(session.session_id, design.id, true);
      setSession(updated);
      toast.success(`Deleted design #${index + 1}.`);
      onCloseModal();
      if (nextDesignId) {
        onSelectDesign(nextDesignId);
      } else if (prevDesignId) {
        onSelectDesign(prevDesignId);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete design");
    } finally {
      setIsDeleting(false);
    }
  };

  const sheetRowsStr =
    design.sheet_rows.length > 1
      ? `rows ${design.sheet_rows[0]}..${design.sheet_rows[design.sheet_rows.length - 1]}`
      : design.sheet_rows.length === 1
      ? `row ${design.sheet_rows[0]}`
      : "manual slot";

  const imagesCount = (session?.design_image_edits[design.id] || design.image_urls).filter(Boolean).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      {/* 1. Design Header Card */}
      <Card shadow="sm" className="border border-divider bg-content1 rounded-[14px]">
        <CardHeader className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          {/* Thumbnail & Title metadata */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Thumbnail 48px */}
            <div className="w-12 h-12 rounded-[10px] bg-content3 border border-divider overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm text-default-400">
              {design.main_image_url ? (
                <img
                  src={design.main_image_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                `#${index + 1}`
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
                  #{index + 1} {design.base || "Unnamed stub"}
                </h2>
              </div>
              <div className="text-xs text-default-400 mt-0.5 flex items-center gap-2 font-medium">
                <span>{sheetRowsStr}</span>
                <span>•</span>
                <span>{sizes.length} sizes configured</span>
              </div>
            </div>

            <div className="ml-2">
              <StatusChip status={design.status} size="sm" />
            </div>
          </div>

          {/* Navigation Pager & Delete Slot */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-default-500 whitespace-nowrap px-1">
              {index + 1} of {total}
            </span>

            <Button
              size="sm"
              isIconOnly
              variant="flat"
              isDisabled={!prevDesignId}
              onPress={() => prevDesignId && onSelectDesign(prevDesignId)}
              aria-label="Previous design"
              className="h-9 w-9 rounded-[10px] text-default-600 bg-content3 border border-divider"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              size="sm"
              isIconOnly
              variant="flat"
              isDisabled={!nextDesignId}
              onPress={() => nextDesignId && onSelectDesign(nextDesignId)}
              aria-label="Next design"
              className="h-9 w-9 rounded-[10px] text-default-600 bg-content3 border border-divider"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Tooltip content="Delete this design slot">
              <Button
                size="sm"
                isIconOnly
                variant="light"
                color="danger"
                onPress={onOpenDelete}
                className="h-9 w-9 rounded-[10px] text-default-400 hover:text-danger ml-1"
                aria-label="Delete slot"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </CardHeader>
      </Card>

      {/* Complete State Alert Banner if ready */}
      {design.status === "complete" && (
        <div className="p-3.5 rounded-[10px] border border-success-200 dark:border-success-900/40 bg-success-50/50 dark:bg-success-950/20 flex flex-row items-center justify-between text-xs text-success-800 dark:text-success-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>This design has complete data ({sizes.length} size rows with prices & description).</span>
          </div>
          <Button
            size="sm"
            variant="flat"
            color="success"
            className="font-medium text-xs h-7 rounded-[8px]"
            onPress={() => {
              design.status = "needs_json";
              if (session) setSession({ ...session });
            }}
          >
            Re-edit JSON
          </Button>
        </div>
      )}

      {/* 2. Product JSON Editor Card First */}
      <Card shadow="sm" className="border border-divider bg-content1 rounded-[14px]">
        <CardHeader className="px-5 pt-4 pb-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Product JSON</h3>
        </CardHeader>
        <CardBody className="px-5 pb-5 pt-2">
          {session && (
            <JsonEditor
              sessionId={session.session_id}
              designId={design.id}
              initialText={initialJsonText}
              onValidated={(res) => {
                setPreviewRows(res.preview_rows);
                design.status = res.status;
                if (session) setSession({ ...session });
              }}
            />
          )}
        </CardBody>
      </Card>

      {/* 3. Sizes Section (All Boxes Equal Dimensions) */}
      <Card shadow="sm" className="border border-divider bg-content1 rounded-[14px]">
        <CardBody className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-foreground">Brand sizes to generate</div>
            <div className="text-xs text-default-400 mt-0.5">
              Select which sizes to write into the workbook ({sizes.length} rows)
            </div>
          </div>

          {/* Equal Uniform Size Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_SIZES.map((s) => {
              const isSelected = sizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleToggleSize(s)}
                  aria-pressed={isSelected}
                  className={`w-11 sm:w-12 h-9 rounded-[10px] border flex items-center justify-center font-semibold text-xs select-none transition-all duration-120 active:scale-95 ${
                    isSelected
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-content2 hover:bg-content3 text-default-600 border-divider hover:border-default-400"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            <span className="text-xs text-default-400 font-medium ml-1">
              {sizes.length} rows
            </span>
          </div>
        </CardBody>
      </Card>

      {/* 4. Secondary Section: Image Links (Clean summary row) */}
      <Card shadow="sm" className="border border-divider bg-content1 rounded-[14px] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsImagesExpanded(!isImagesExpanded)}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-content3/50 transition-colors text-left focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="w-4 h-4 text-default-400" />
            <div>
              <span className="text-sm font-semibold text-foreground">
                Image links
              </span>
              <p className="text-xs text-default-400 mt-0.5">
                {imagesCount}/7 product image links configured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium">
              {isImagesExpanded ? "Collapse" : "Edit"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-default-400 transition-transform duration-200 ${
                isImagesExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {isImagesExpanded && session && (
          <div className="p-5 border-t border-divider bg-content2/40 transition-all duration-200">
            <ImageLinksEditor
              imageUrls={session.design_image_edits[design.id] || design.image_urls}
              productLink={session.design_product_links?.[design.id] || design.product_link}
              isManualSlot={design.is_manual_slot}
              onSave={handleSaveImages}
            />
          </div>
        )}
      </Card>

      {/* 6. Live Rows Preview when ready */}
      {previewRows.length > 0 && (
        <Card shadow="sm" className="border border-divider bg-content1 rounded-[14px]">
          <CardHeader className="px-5 pt-4 pb-1">
            <h3 className="text-sm font-semibold text-foreground">Generated Sheet Rows Preview</h3>
          </CardHeader>
          <CardBody className="p-5 pt-2">
            <RowsPreview rows={previewRows} />
          </CardBody>
        </Card>
      )}

      {/* Delete Slot Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteChange} size="sm">
        <ModalContent className="rounded-[14px] border border-divider bg-content1 shadow-xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-semibold border-b border-divider py-3 px-5">
                Delete design slot?
              </ModalHeader>
              <ModalBody className="text-sm text-default-600 p-5">
                Are you sure you want to delete <strong>#{index + 1} {design.base || "design"}</strong>? This action will remove it from the session.
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3 px-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-[10px]">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  isLoading={isDeleting}
                  onPress={() => handleDelete(onClose)}
                  className="rounded-[10px] font-medium"
                >
                  Delete slot
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
