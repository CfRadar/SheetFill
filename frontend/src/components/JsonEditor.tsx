import React, { useEffect, useRef, useState } from "react";
import { getJsonTemplate, saveDesignJson } from "../api";
import { PutJsonResponse, ValidationIssue } from "../types";

interface JsonEditorProps {
  sessionId: string;
  designId: string;
  initialText: string;
  onValidated: (res: PutJsonResponse) => void;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  sessionId,
  designId,
  initialText,
  onValidated,
}) => {
  const [text, setText] = useState<string>(initialText || "");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const debounceTimer = useRef<any>(null);

  const validate = async (val: string) => {
    if (!val.trim()) {
      setIssues([]);
      return;
    }
    try {
      setIsValidating(true);
      const res = await saveDesignJson(sessionId, designId, val);
      setIssues([...res.errors, ...res.warnings]);
      onValidated(res);
    } catch (err: any) {
      setIssues([
        {
          level: "ERROR",
          field: "JSON",
          message: err?.message || "Validation failed",
        },
      ]);
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
    }, 500);
  };

  const handleCopyTemplate = async () => {
    try {
      const templateObj = await getJsonTemplate(sessionId, designId);
      const str = JSON.stringify(templateObj, null, 2);
      await navigator.clipboard.writeText(str);
      setCopySuccess(true);
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
    } catch (err) {
      // If parsing fails, just trigger validate to display precise error
      validate(text);
    }
  };

  const handleApplySuggestion = (field: string, suggestion: string) => {
    try {
      const obj = JSON.parse(text);
      if (field in obj) {
        obj[field] = suggestion;
      } else {
        // try lowercase / mapping alias
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

  return (
    <div className="space-y-3">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Product Specification JSON</span>
          {isValidating && <span className="text-xs text-blue-500 animate-pulse">Checking...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyTemplate}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded shadow-xs transition-colors"
          >
            {copySuccess ? "Copied!" : "Copy JSON template"}
          </button>
          <button
            type="button"
            onClick={handleFormatRepair}
            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
          >
            Repair & format
          </button>
        </div>
      </div>

      {/* Editor Textarea */}
      <div className="relative">
        <textarea
          rows={8}
          value={text}
          onChange={handleChange}
          placeholder='{\n  "product_title": "...",\n  "material": "Cotton Blend",\n  ...\n}'
          className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* Errors & Suggestions List */}
      {issues.length > 0 && (
        <div className="space-y-1.5">
          {issues.map((iss, i) => (
            <div
              key={i}
              className={`p-2 text-xs rounded-md border flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                iss.level === "ERROR"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <div>
                <strong className="font-semibold uppercase text-[10px] tracking-wide mr-1.5">
                  [{iss.level}] {iss.field}:
                </strong>
                <span>{iss.message}</span>
              </div>
              {iss.suggestions && iss.suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium opacity-80">Suggestions:</span>
                  {iss.suggestions.slice(0, 3).map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleApplySuggestion(iss.field, sug)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-current rounded hover:bg-opacity-20 transition-colors"
                    >
                      Use "{sug}"
                    </button>
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
