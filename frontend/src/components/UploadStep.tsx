import React, { useState, useRef, useCallback } from "react";
import { Chip, Progress, Alert } from "@heroui/react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { uploadSheet } from "../api";
import { useAppStore } from "../store";
import { toast } from "../ui/ToastProvider";
import { PageFade } from "../ui/PageFade";
import { AntigravityCanvas } from "../ui/AntigravityCanvas";

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const UploadStep: React.FC = () => {
  const { setSession, setLoading, setError, loading, error } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xls", "xlsm", "xlsx"].includes(ext || "")) {
        setError("Please select a valid Flipkart Excel workbook (.xlsm, .xls, or .xlsx).");
        return;
      }

      setSelectedFile(file);
      try {
        setLoading(true);
        setError(null);
        const session = await uploadSheet(file);
        setSession(session);
        toast.success(
          `Workbook analyzed: ${session.designs.length} designs detected.`,
          "Upload complete"
        );
        // Update URL with sid
        const url = new URL(window.location.href);
        url.searchParams.set("sid", session.session_id);
        window.history.pushState({}, "", url.toString());
      } catch (err: any) {
        setError(err?.message || "Failed to analyze workbook");
        setSelectedFile(null);
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading, setSession]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDropzoneClick = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDropzoneClick();
    } else if (e.key === "Escape") {
      setIsDragging(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <PageFade className="w-full max-w-2xl mx-auto py-12 sm:py-20 px-4 flex flex-col items-center">
      {/* Hero Header */}
      <div className="flex flex-col items-center text-center mb-8 max-w-lg">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-indigo-500/20 text-primary flex items-center justify-center mb-4 shadow-xs border border-primary/20">
          <UploadCloud className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Upload Flipkart Listing Sheet
        </h1>
        <p className="text-sm text-default-500 mt-2 leading-relaxed">
          Drop your .xlsm or .xls workbook to automatically extract and populate designs
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="w-full mb-5">
          <Alert
            color="danger"
            variant="flat"
            title="Upload failed"
            description={error}
            isClosable
            onClose={() => setError(null)}
          />
        </div>
      )}

      {/* Hero Dropzone Container */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Excel workbook dropzone"
        onClick={handleDropzoneClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full min-h-[320px] sm:min-h-[360px] relative border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 select-none overflow-hidden flex flex-col items-center justify-center bg-content1/80 backdrop-blur-md shadow-sm ${
          isDragging
            ? "border-primary bg-primary-50/50 dark:bg-primary-950/30 scale-[1.01]"
            : "border-divider/90 hover:border-primary/60 dark:border-divider/70 dark:hover:border-primary/50 hover:bg-content2/50"
        }`}
      >
        {/* Antigravity floating particles canvas */}
        <AntigravityCanvas isInteracting={isDragging} />

        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsm,.xlsx"
          onChange={handleFileInputChange}
          className="sr-only"
          tabIndex={-1}
          disabled={loading}
        />

        <div className="relative z-10 flex flex-col items-center max-w-md">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              {selectedFile && (
                <Chip
                  variant="flat"
                  color="primary"
                  startContent={<FileSpreadsheet className="w-4 h-4 ml-1" />}
                  className="max-w-full truncate"
                >
                  {selectedFile.name} ({formatBytes(selectedFile.size)})
                </Chip>
              )}
              <Progress
                size="sm"
                isIndeterminate
                color="primary"
                aria-label="Analyzing workbook"
                label="Analyzing workbook structure and detecting designs..."
                className="w-full max-w-sm mt-3"
              />
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <Chip
                variant="flat"
                color="primary"
                startContent={<FileSpreadsheet className="w-4 h-4 ml-1" />}
                onClose={handleClearFile}
                className="max-w-full truncate text-xs font-semibold"
              >
                {selectedFile.name} ({formatBytes(selectedFile.size)})
              </Chip>
              <p className="text-xs text-default-400 mt-2">
                Click or drag another file to replace
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-content2/90 border border-divider/80 flex items-center justify-center mb-4 shadow-xs">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Choose workbook or drag & drop here
              </p>
              <p className="text-xs text-default-400 mt-1">
                Click to browse files from your computer
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Single quiet capability line under the dropzone */}
      <p className="text-xs text-default-400 mt-4 tracking-wide text-center">
        Supports .xlsm & .xls · Macro-safe · Max 25 MB
      </p>
    </PageFade>
  );
};
