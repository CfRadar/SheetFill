import React, { useState, useEffect } from "react";
import {
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
    unlock?: boolean
  ) => {
    if (!session) return;
    try {
      await saveDesignImages(session.session_id, design.id, urls, productLink, unlock);
      design.image_urls = urls;
      design.main_image_url = urls[0] || null;
      if (productLink !== undefined) {
        design.product_link = productLink;
      }
      setSession({
        ...session,
        designs: session.designs.map((d) =>
          d.id === design.id
            ? {
                ...d,
                image_urls: urls,
                main_image_url: urls[0] || null,
                product_link: productLink !== undefined ? productLink : d.product_link,
              }
            : d
        ),
      });
      toast.success("Image links updated");
    } catch (err: any) {
      setError(err?.message || "Failed to save images");
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      const res = await deleteDesign(sessionId, design.id);
      setSession(res);
      toast.success("Design deleted");
      onDeleteChange();

      // Navigate to next design if available, else prev
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

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Header Bar: Design Name, Navigation Pager & Delete Action */}
      <div className="p-3.5 sm:px-5 sm:py-3 rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md shadow-xs flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">
              {design.base || "Design"}
            </h2>
            <p className="text-[11px] text-default-400 font-mono">
              SKU: {design.base || "Slot"} · {sizes.length} sizes
            </p>
          </div>
          <div className="ml-1">
            <StatusChip status={design.status} size="sm" />
          </div>
        </div>

        {/* Navigation Pager & Delete Slot */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-default-500 whitespace-nowrap px-1">
            {index + 1} of {total}
          </span>

          <Button
            size="sm"
            isIconOnly
            variant="flat"
            isDisabled={!prevDesignId}
            onPress={() => prevDesignId && onSelectDesign(prevDesignId)}
            aria-label="Previous design"
            className="h-8 w-8 rounded-xl text-default-600 bg-content2 border border-divider"
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
            className="h-8 w-8 rounded-xl text-default-600 bg-content2 border border-divider"
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
              className="h-8 w-8 rounded-xl text-default-400 hover:text-danger ml-0.5"
              aria-label="Delete slot"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Complete State Alert Banner if ready */}
      {design.status === "complete" && (
        <div className="p-3.5 rounded-xl border border-success-200 dark:border-success-900/40 bg-success-50/60 dark:bg-success-950/20 flex flex-row items-center justify-between text-xs text-success-800 dark:text-success-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>This design is verified with complete product data ({sizes.length} size rows).</span>
          </div>
          <Button
            size="sm"
            variant="flat"
            color="success"
            className="font-semibold text-xs h-7 rounded-lg"
            onPress={() => {
              design.status = "needs_json";
              if (session) setSession({ ...session });
            }}
          >
            Re-edit JSON
          </Button>
        </div>
      )}

      {/* 2. Product JSON Code Editor (Clean elevated panel, zero duplicate cards) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md shadow-xs">
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
      </div>

      {/* 3. Sizes Section (Uniform Pill Group with Spring Animation) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-foreground">Brand sizes to generate</div>
          <div className="text-[11px] text-default-400 mt-0.5">
            {sizes.length} rows will be written to the sheet for this design
          </div>
        </div>

        {/* Uniform Size Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {BRAND_SIZES.map((s) => {
            const isSelected = sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleToggleSize(s)}
                aria-pressed={isSelected}
                className={`w-10 sm:w-11 h-8 rounded-xl border flex items-center justify-center font-bold text-xs select-none transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-content2/60 hover:bg-content2 text-default-600 border-divider hover:border-default-400"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Secondary Section: Image Links (Collapsible Accordion) */}
      <div className="rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsImagesExpanded(!isImagesExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-content2/40 transition-colors text-left focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="w-4 h-4 text-primary" />
            <div>
              <span className="text-xs font-bold text-foreground">Image Links</span>
              <p className="text-[11px] text-default-400">
                Front, back and side view image URLs for Flipkart listing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-default-400">
              {(design.image_urls || []).filter(Boolean).length} images
            </span>
            <ChevronDown
              className={`w-4 h-4 text-default-400 transition-transform duration-200 ${
                isImagesExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {isImagesExpanded && (
          <div className="p-4 sm:p-5 border-t border-divider/60 bg-content2/20">
            <ImageLinksEditor
              imageUrls={design.image_urls || []}
              productLink={design.product_link || null}
              isManualSlot={design.is_manual_slot}
              onSave={handleSaveImages}
            />
          </div>
        )}
      </div>

      {/* 5. Generated Sheet Rows Preview Table */}
      {previewRows.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md shadow-xs">
          <RowsPreview rows={previewRows} />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteChange} size="sm">
        <ModalContent className="rounded-2xl border border-divider bg-content1 shadow-2xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-bold border-b border-divider py-3.5 px-5">
                Delete Design Slot?
              </ModalHeader>
              <ModalBody className="text-sm text-default-600 p-5 leading-relaxed">
                Are you sure you want to delete{" "}
                <strong className="text-foreground">#{index + 1} {design.base}</strong>? Its data and assigned rows will be removed from this session.
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3.5 px-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  className="rounded-xl font-medium"
                  isLoading={isDeleting}
                  onPress={handleDelete}
                >
                  Delete Design
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
