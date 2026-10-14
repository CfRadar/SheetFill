import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Chip,
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
import { deleteDesign, saveDesignImages, saveDesignSizes } from "../api";
import { useAppStore } from "../store";
import { DetectedDesign, PreviewRow } from "../types";
import { StatusChip } from "../ui/StatusChip";
import { JsonEditor } from "../components/JsonEditor";
import { BrandMetaEditor } from "../components/BrandMetaEditor";
import { ImageLinksEditor } from "../components/ImageLinksEditor";
import { RowsPreview } from "../components/RowsPreview";
import { toast } from "../ui/ToastProvider";

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

  const [sizes, setSizes] = useState<string[]>(
    session?.design_sizes[design.id] ||
      (design.sizes_found.length > 0 ? design.sizes_found : ["S", "M", "L", "XL"])
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isBrandMetaExpanded, setIsBrandMetaExpanded] = useState(false);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete modal disclosure
  const {
    isOpen: isDeleteOpen,
    onOpen: onOpenDelete,
    onOpenChange: onDeleteChange,
  } = useDisclosure();

  const initialJsonText = session?.design_raw_text[design.id] || "";

  const handleToggleSize = async (size: string) => {
    const next = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size];
    if (next.length === 0) return; // Minimum 1 size required
    setSizes(next);
    if (session) {
      await saveDesignSizes(session.session_id, design.id, next);
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

  const currentMeta = session?.design_meta?.[design.id] || session?.global_meta || {};
  const currentBrand = currentMeta.brand || design.existing_values?.["AG"] || "fashion continental";
  const currentHsn = currentMeta.hsn || design.existing_values?.["Y"] || "61091000";
  const imagesCount = (session?.design_image_edits[design.id] || design.image_urls).filter(Boolean).length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Design Header Card */}
      <Card shadow="sm" className="border border-divider bg-content1">
        <CardHeader className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-default-100 border border-divider overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm text-default-400">
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
                <h3 className="text-base font-bold text-foreground truncate">
                  #{index + 1} {design.base || "Unnamed stub"}
                </h3>
                <span className="text-xs text-default-400 font-mono">({sheetRowsStr})</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusChip status={design.status} size="sm" />
                <span className="text-xs text-default-400">
                  {sizes.length} sizes configured
                </span>
              </div>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-400 font-medium mr-1">
              {index + 1} of {total}
            </span>

            <Button
              size="sm"
              isIconOnly
              variant="flat"
              isDisabled={!prevDesignId}
              onPress={() => prevDesignId && onSelectDesign(prevDesignId)}
              aria-label="Previous design"
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              size="sm"
              variant="light"
              color="danger"
              startContent={<Trash2 className="w-3.5 h-3.5" />}
              onPress={onOpenDelete}
              className="text-xs"
            >
              Delete slot
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Complete State Alert Banner */}
      {design.status === "complete" && (
        <Card shadow="sm" className="border border-success-200 bg-success-50/50 dark:bg-success-950/20">
          <CardBody className="p-3.5 flex flex-row items-center justify-between text-xs text-success-800 dark:text-success-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
              <span>This design has complete data (4 size rows with prices & description).</span>
            </div>
            <Button
              size="sm"
              variant="flat"
              color="success"
              className="font-medium text-xs h-7"
              onPress={() => {
                design.status = "needs_json";
                if (session) setSession({ ...session });
              }}
            >
              Re-edit JSON
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Primary Section: Product JSON Editor */}
      <Card shadow="sm" className="border border-divider bg-content1">
        <CardHeader className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Product JSON</h4>
            <p className="text-xs text-default-400">
              Paste or edit the product specification JSON for this design
            </p>
          </div>
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

      {/* Size Selection Section */}
      <Card shadow="sm" className="border border-divider bg-content1">
        <CardBody className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-foreground">Brand sizes to generate</div>
            <div className="text-[11px] text-default-400">
              Select which sizes to write into the workbook ({sizes.length} rows)
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_SIZES.map((s) => {
              const isSelected = sizes.includes(s);
              return (
                <Chip
                  key={s}
                  variant={isSelected ? "solid" : "bordered"}
                  color={isSelected ? "primary" : "default"}
                  size="sm"
                  className="cursor-pointer select-none font-semibold transition-all"
                  onClick={() => handleToggleSize(s)}
                >
                  {s}
                </Chip>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Secondary Section: Brand, Manufacturer & HSN (Collapsed by default) */}
      <Card shadow="sm" className="border border-divider bg-content1 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsBrandMetaExpanded(!isBrandMetaExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-content2/40 transition-colors text-left focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <Tag className="w-4 h-4 text-default-400" />
            <div>
              <span className="text-xs font-semibold text-foreground">
                Brand & HSN details
              </span>
              <p className="text-[11px] text-default-400 mt-0.5">
                Brand: <strong className="text-foreground">{currentBrand}</strong> • HSN:{" "}
                <strong className="text-foreground">{currentHsn}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium">
              {isBrandMetaExpanded ? "Collapse" : "Edit"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-default-400 transition-transform duration-200 ${
                isBrandMetaExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {isBrandMetaExpanded && session && (
          <div className="p-4 border-t border-divider bg-content2/20">
            <BrandMetaEditor
              sessionId={session.session_id}
              design={design}
              onMetaUpdated={(_meta, rows) => {
                if (rows && rows.length > 0) {
                  setPreviewRows(rows);
                }
              }}
            />
          </div>
        )}
      </Card>

      {/* Secondary Section: Image Links (Collapsed by default) */}
      <Card shadow="sm" className="border border-divider bg-content1 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsImagesExpanded(!isImagesExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-content2/40 transition-colors text-left focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4 text-default-400" />
            <div>
              <span className="text-xs font-semibold text-foreground">Image links</span>
              <p className="text-[11px] text-default-400 mt-0.5">
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
          <div className="p-4 border-t border-divider bg-content2/20">
            <ImageLinksEditor
              imageUrls={session?.design_image_edits[design.id] || design.image_urls}
              productLink={session?.design_product_links[design.id] ?? design.product_link}
              isManualSlot={design.is_manual_slot}
              onSave={handleSaveImages}
            />
          </div>
        )}
      </Card>

      {/* Row Preview Table */}
      {previewRows.length > 0 && (
        <Card shadow="sm" className="border border-divider bg-content1">
          <CardBody className="p-4">
            <RowsPreview rows={previewRows} />
          </CardBody>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteChange} size="sm">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-semibold">Delete design slot?</ModalHeader>
              <ModalBody className="text-sm text-default-600">
                Are you sure you want to remove #{index + 1}{" "}
                <strong>{design.base || "Unnamed stub"}</strong>? Any filled JSON and metadata for
                this slot will be discarded.
              </ModalBody>
              <ModalFooter>
                <Button size="sm" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  isLoading={isDeleting}
                  onPress={() => handleDelete(onClose)}
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
