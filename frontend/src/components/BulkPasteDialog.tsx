import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Textarea,
} from "@heroui/react";
import { Sparkles, ClipboardPaste } from "lucide-react";
import { bulkAssignJson, confirmBulkAssign } from "../api";
import { useAppStore } from "../store";
import { BulkAssignResponse } from "../types";
import { toast } from "../ui/ToastProvider";

interface BulkPasteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkPasteDialog: React.FC<BulkPasteDialogProps> = ({ isOpen, onClose }) => {
  const { session, setSession, setError } = useAppStore();
  const [rawText, setRawText] = useState("");
  const [matchResult, setMatchResult] = useState<BulkAssignResponse | null>(null);
  const [manualPairs, setManualPairs] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  if (!session) return null;

  const handleMatch = async () => {
    if (!rawText.trim()) return;
    try {
      setIsProcessing(true);
      const res = await bulkAssignJson(session.session_id, rawText);
      setMatchResult(res);
      setManualPairs({});
    } catch (err: any) {
      setError(err?.message || "Failed to process bulk JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!matchResult) return;
    try {
      setIsProcessing(true);
      const pairs: { design_id: string; json_index: number; parsed_json: any }[] = [];

      // 1. Confirmed assigned
      for (const a of matchResult.assigned) {
        pairs.push({
          design_id: a.design_id,
          json_index: a.json_index,
          parsed_json: a.parsed_json,
        });
      }

      // 2. Manual pairs
      for (const [jIdxStr, did] of Object.entries(manualPairs)) {
        if (did) {
          const jIdx = parseInt(jIdxStr);
          const unmatchedObj = matchResult.unmatched_json.find((u) => u.json_index === jIdx);
          if (unmatchedObj) {
            pairs.push({
              design_id: did,
              json_index: jIdx,
              parsed_json: unmatchedObj.parsed_json,
            });
          }
        }
      }

      const updated = await confirmBulkAssign(session.session_id, pairs);
      setSession(updated);
      toast.success(`Applied JSON specifications to ${pairs.length} design slots.`);
      onClose();
      setMatchResult(null);
      setRawText("");
    } catch (err: any) {
      setError(err?.message || "Failed to apply matched JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setMatchResult(null);
    setRawText("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="3xl"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: "rounded-[14px] border border-divider bg-content1 shadow-xl",
        header: "border-b border-divider py-4 px-6",
        body: "p-6",
        footer: "border-t border-divider py-3.5 px-6",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center text-primary">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Paste all product JSONs</h3>
                  <p className="text-xs text-default-400 font-normal mt-0.5">Bulk correlation across design slots</p>
                </div>
              </div>
              <Chip size="sm" variant="flat" color="primary" className="font-medium text-xs rounded-full">
                Multi-design matching
              </Chip>
            </ModalHeader>

            <ModalBody className="p-6">
              {!matchResult ? (
                <div className="space-y-3">
                  <p className="text-xs text-default-500">
                    Paste a JSON array <code>[{`{...}`}, {`{...}`}]</code> or multiple JSON objects.
                    The matcher correlates them automatically with your workbook designs by SKU base or title.
                  </p>
                  <Textarea
                    data-testid="bulk-json-textarea"
                    minRows={12}
                    maxRows={20}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder='[\n  {\n    "sku_base": "classic_polo_black",\n    "product_title": "Men Solid Polo...",\n    ...\n  }\n]'
                    variant="bordered"
                    className="font-mono text-xs"
                    aria-label="Bulk JSON input"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Matching results ({matchResult.assigned.length} matched,{" "}
                      {matchResult.unmatched_json.length} unmatched)
                    </span>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={() => setMatchResult(null)}
                      className="text-xs h-7"
                    >
                      Edit raw JSON
                    </Button>
                  </div>

                  {/* Assignments Table */}
                  <div className="border border-divider rounded-[12px] overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-content2/70 border-b border-divider text-default-400 font-semibold text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">JSON Title / Base</th>
                          <th className="py-2.5 px-3">Matched Design Slot</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider">
                        {matchResult.assigned.map((a, i) => (
                          <tr key={i} className="hover:bg-content2/30 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-foreground">
                              {a.json_base || a.parsed_json?.product_title || `#${a.json_index + 1}`}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-primary">
                              {a.design_base || a.design_id}
                            </td>
                            <td className="py-2.5 px-3">
                              <Chip
                                size="sm"
                                variant="flat"
                                color={
                                  a.how === "exact"
                                    ? "success"
                                    : a.how === "normalized" || a.how === "suffix"
                                    ? "primary"
                                    : "warning"
                                }
                                className="text-[11px] font-semibold"
                              >
                                {a.how}
                              </Chip>
                            </td>
                            <td className="py-2.5 px-3 text-default-500 font-mono">
                              {Math.round(a.confidence * 100)}%
                            </td>
                          </tr>
                        ))}

                        {/* Unmatched JSON items */}
                        {matchResult.unmatched_json.map((u) => (
                          <tr key={u.json_index} className="bg-danger-50/20 dark:bg-danger-950/20">
                            <td className="py-2.5 px-3 font-medium text-danger">
                              {u.parsed_json?.sku_base ||
                                u.parsed_json?.product_title ||
                                `JSON #${u.json_index + 1}`}
                            </td>
                            <td className="py-2.5 px-3" colSpan={3}>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-danger font-medium whitespace-nowrap">
                                  Unmatched. Assign to:
                                </span>
                                <select
                                  value={manualPairs[u.json_index] || ""}
                                  onChange={(e) =>
                                    setManualPairs({
                                      ...manualPairs,
                                      [u.json_index]: e.target.value,
                                    })
                                  }
                                  className="text-xs p-1.5 rounded-[8px] border border-divider bg-content1 text-foreground"
                                >
                                  <option value="">-- Choose Design Slot --</option>
                                  {session.designs.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.id}: {d.base || "Unnamed"}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button size="sm" variant="light" onPress={handleClose} className="rounded-[10px] text-xs font-medium">
                Cancel
              </Button>
              {!matchResult ? (
                <Button
                  size="sm"
                  color="primary"
                  isLoading={isProcessing}
                  isDisabled={!rawText.trim()}
                  startContent={!isProcessing && <Sparkles className="w-3.5 h-3.5" />}
                  onPress={handleMatch}
                  className="font-semibold rounded-[10px] text-xs h-9 px-4"
                >
                  Analyze & match
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="success"
                  isLoading={isProcessing}
                  onPress={handleConfirm}
                  className="font-semibold text-white shadow-sm rounded-[10px] text-xs h-9 px-4"
                >
                  Apply all matches
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
