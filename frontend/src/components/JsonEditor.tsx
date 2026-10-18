import React, { useEffect, useRef, useState } from "react";
import { Button, Chip } from "@heroui/react";
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Wand2,
  Check,
  ClipboardPaste,
  Code2,
} from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handlePasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && clip.trim()) {
        setText(clip);
        validate(clip);
        toast.success("JSON pasted from clipboard!");
      }
    } catch {
      toast.error("Please paste directly into the editor.");
      textareaRef.current?.focus();
    }
  };

  const handleFormatRepair = () => {
    try {
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
        if (foundKey) {
          obj[foundKey] = suggestion;
        }
      }
      const updated = JSON.stringify(obj, null, 2);
      setText(updated);
      validate(updated);
      toast.success(`Updated ${field} to "${suggestion}"`);
    } catch (e) {
      console.error("Could not auto-apply suggestion", e);
    }
  };

  // Sync when designId changes
  useEffect(() => {
    setText(initialText || "");
    setIssues([]);
    if (initialText && initialText.trim()) {
      validate(initialText);
    }
  }, [designId, initialText]);

  const errorIssues = issues.filter((i) => i.level === "ERROR");
  const hasText = text.trim().length > 0;
  const isValid = hasText && errorIssues.length === 0;

  // Compute line numbers
  const lineCount = Math.max(10, text.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Small Compact Editor Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Product Specification JSON</span>

          {/* Validation Status Badge */}
          {isValidating ? (
            <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px] font-mono animate-pulse">
              Validating...
            </Chip>
          ) : !hasText ? (
            <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px] text-default-400">
              Empty
            </Chip>
          ) : isValid ? (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              startContent={<CheckCircle2 className="w-3 h-3 ml-0.5" />}
              className="h-5 text-[10px] font-bold"
            >
              Valid
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="flat"
              color="danger"
              startContent={<AlertCircle className="w-3 h-3 ml-0.5" />}
              className="h-5 text-[10px] font-bold"
            >
              {errorIssues.length} error{errorIssues.length > 1 ? "s" : ""}
            </Chip>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="light"
            onPress={handleCopyTemplate}
            startContent={copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-default-400" />}
            className="h-7 px-2.5 rounded-lg text-xs font-medium text-default-600 hover:text-foreground"
          >
            {copySuccess ? "Copied" : "Copy template"}
          </Button>

          <Button
            size="sm"
            variant="flat"
            color="default"
            onPress={handleFormatRepair}
            startContent={<Wand2 className="w-3.5 h-3.5 text-default-500" />}
            className="h-7 px-2.5 rounded-lg text-xs font-medium text-foreground bg-content2 hover:bg-default-200 border border-divider/80"
          >
            Repair & format
          </Button>
        </div>
      </div>

      {/* Code Editor Frame with Line Numbers and Empty State */}
      <div className="relative rounded-2xl border border-divider/80 bg-content2/40 overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
        {!hasText ? (
          /* Inline Empty State */
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[220px]">
            <div className="w-12 h-12 rounded-2xl bg-content1 border border-divider/80 flex items-center justify-center mb-3 text-default-400">
              <ClipboardPaste className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              No JSON specified for this design
            </p>
            <p className="text-xs text-default-400 mt-1 max-w-sm mb-4">
              Paste product attributes generated from ChatGPT or use our pre-built Flipkart template
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                color="primary"
                onPress={handlePasteClipboard}
                startContent={<ClipboardPaste className="w-3.5 h-3.5" />}
                className="rounded-xl text-xs font-semibold px-4"
              >
                Paste from Clipboard
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={handleCopyTemplate}
                startContent={<Copy className="w-3.5 h-3.5" />}
                className="rounded-xl text-xs font-medium px-3"
              >
                Insert Template
              </Button>
            </div>
          </div>
        ) : (
          /* Code Editor with Line Numbers Gutter */
          <div className="flex min-h-[220px] max-h-[460px] overflow-hidden">
            {/* Line Numbers Gutter */}
            <div
              className="w-10 select-none py-3.5 bg-content3/40 dark:bg-content1/40 border-r border-divider/60 text-right pr-2 font-mono text-xs text-default-400 shrink-0 overflow-hidden leading-relaxed"
              aria-hidden="true"
            >
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={lineCount}
              value={text}
              onChange={handleChange}
              placeholder='{\n  "product_title": "Men Oversized Printed T-Shirt",\n  ...\n}'
              className="flex-1 font-mono text-[13px] p-3.5 bg-transparent text-foreground focus:outline-none leading-relaxed resize-y select-text"
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {/* Issues & Quick-Fix Suggestions */}
      {issues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {issues.map((iss, i) => (
            <div
              key={i}
              className={`p-3 text-xs rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 transition-colors ${
                iss.level === "ERROR"
                  ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-100"
                  : "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100"
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
                      className="h-6 text-[11px] px-2 rounded-lg font-medium"
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
