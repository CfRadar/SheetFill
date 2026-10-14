import React, { useEffect, useRef, useState } from "react";
import { Button, Chip } from "@heroui/react";
import { CheckCircle2, AlertCircle, Copy, Wand2, Check } from "lucide-react";
import { getJsonTemplate, saveDesignJson } from "../api";
import { PutJsonResponse, ValidationIssue } from "../types";
import { toast } from "../ui/ToastProvider";

interface JsonEditorProps {
  sessionId: string;
  designId: string;
  initialText: string;
  onValidated: (res: PutJsonResponse) => void;
  onReadyStateChange?: (isReady: boolean) => void;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  sessionId,
  designId,
  initialText,
  onValidated,
  onReadyStateChange,
}) => {
  const [text, setText] = useState<string>(initialText || "");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const debounceTimer = useRef<any>(null);

  const validate = async (val: string) => {
    if (!val.trim()) {
      setIssues([]);
      onReadyStateChange?.(false);
      return;
    }
    try {
      setIsValidating(true);
      const res = await saveDesignJson(sessionId, designId, val);
      setIssues([...res.errors, ...res.warnings]);
      onValidated(res);
      onReadyStateChange?.(res.status === "ready");
    } catch (err: any) {
      setIssues([
        {
          level: "ERROR",
          field: "JSON",
          message: err?.message || "Validation failed",
        },
      ]);
      onReadyStateChange?.(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      validate(val);
    }, 450);
  };

  const handleCopyTemplate = async () => {
    try {
      const templateObj = await getJsonTemplate(sessionId, designId);
      const str = JSON.stringify(templateObj, null, 2);
      await navigator.clipboard.writeText(str);
      setCopySuccess(true);
      toast.success("JSON template copied!");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormatRepair = () => {
    try {
      // Basic repair: remove smart quotes, trailing commas
      let clean = text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1");
      const obj = JSON.parse(clean);
      const formatted = JSON.stringify(obj, null, 2);
      setText(formatted);
      validate(formatted);
      toast.success("JSON formatted and repaired");
    } catch (err) {
      validate(text);
    }
  };

  const handleApplySuggestion = (field: string, suggestion: string) => {
    try {
      const obj = JSON.parse(text);
      if (field in obj) {
        obj[field] = suggestion;
      } else {
        const foundKey = Object.keys(obj).find((k) => k.toLowerCase() === field.toLowerCase());
        if (foundKey) obj[foundKey] = suggestion;
      }
      const updated = JSON.stringify(obj, null, 2);
      setText(updated);
      validate(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const errorIssues = issues.filter((i) => i.level === "ERROR");
  const hasText = text.trim().length > 0;
  const isValid = hasText && !isValidating && errorIssues.length === 0;

  return (
    <div className="space-y-3">
      {/* Action Header with Clean HeroUI Buttons */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Product Specification JSON</span>
          {isValidating && (
            <span className="text-xs text-primary animate-pulse font-medium">Validating...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="light"
            onPress={handleCopyTemplate}
            startContent={copySuccess ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-default-400" />}
            className="h-8 px-2.5 rounded-[8px] text-xs font-medium text-default-600 hover:text-foreground"
          >
            {copySuccess ? "Copied" : "Copy template"}
          </Button>

          <Button
            size="sm"
            variant="flat"
            color="default"
            onPress={handleFormatRepair}
            startContent={<Wand2 className="w-3.5 h-3.5 text-default-500" />}
            className="h-8 px-3 rounded-[8px] text-xs font-medium text-foreground bg-content3 hover:bg-default-200 border border-divider transition-colors"
          >
            Repair & format
          </Button>
        </div>
      </div>

      {/* Editor Textarea with Floating Validation Chip */}
      <div className="relative">
        <textarea
          rows={9}
          value={text}
          onChange={handleChange}
          placeholder='{\n  "product_title": "Women’s Premium Oversized Printed T-Shirt",\n  "material": "Cotton Blend",\n  ...\n}'
          className="w-full font-mono text-[13px] p-4 pb-10 rounded-[10px] border border-divider bg-content3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent leading-relaxed resize-y select-text"
          spellCheck={false}
        />

        {/* Live Validation Chip seated at bottom right of editor box */}
        <div className="absolute right-3 bottom-3 z-10 pointer-events-none">
          {isValidating ? (
            <Chip size="sm" variant="flat" color="primary" className="h-6 text-[11px] font-medium">
              Checking...
            </Chip>
          ) : !hasText ? (
            <Chip size="sm" variant="flat" color="default" className="h-6 text-[11px] font-medium border border-divider">
              No JSON
            </Chip>
          ) : isValid ? (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              startContent={<CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
              className="h-6 text-[11px] font-semibold border border-success-200 dark:border-success-900/40"
            >
              Valid JSON
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="flat"
              color="danger"
              startContent={<AlertCircle className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
              className="h-6 text-[11px] font-semibold border border-danger-200 dark:border-danger-900/40"
            >
              {errorIssues.length} error{errorIssues.length > 1 ? "s" : ""}
            </Chip>
          )}
        </div>
      </div>

      {/* Issues & Quick-Fix Suggestions */}
      {issues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {issues.map((iss, i) => (
            <div
              key={i}
              className={`p-3 text-xs rounded-[10px] border flex flex-col md:flex-row md:items-center justify-between gap-2 transition-colors ${
                iss.level === "ERROR"
                  ? "bg-rose-50/90 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-100"
                  : "bg-amber-50/90 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100"
              }`}
            >
              <div>
                <strong className="font-semibold uppercase text-[10px] tracking-wide mr-1.5 opacity-90">
                  [{iss.level}] {iss.field}:
                </strong>
                <span>{iss.message}</span>
              </div>
              {iss.suggestions && iss.suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium opacity-80">Quick fix:</span>
                  {iss.suggestions.slice(0, 3).map((sug, sIdx) => (
                    <Button
                      key={sIdx}
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => handleApplySuggestion(iss.field, sug)}
                      className="h-6 text-[11px] px-2 rounded-[6px] font-medium"
                    >
                      Use "{sug}"
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
