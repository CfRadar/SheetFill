import React, { useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardBody, Chip, Progress, Alert } from "@heroui/react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { uploadSheet } from "../api";
import { useAppStore } from "../store";
import { toast } from "../ui/ToastProvider";
import { PageFade } from "../ui/PageFade";

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
        setError("Please select a valid Excel workbook (.xls, .xlsm, or .xlsx).");
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
    <PageFade className="w-full max-w-xl mx-auto py-10 sm:py-16 px-4">
      <Card shadow="sm" className="border border-divider bg-content1">
        <CardHeader className="flex flex-col items-center text-center pb-2 pt-6 px-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Upload workbook</h2>
          <p className="text-sm text-default-500 mt-1">
            Drop your Flipkart Excel listing sheet or click to browse
          </p>
        </CardHeader>

        <CardBody className="px-6 pb-6 pt-2 flex flex-col gap-4">
          {error && (
            <Alert
              color="danger"
              variant="flat"
              title="Upload failed"
              description={error}
              isClosable
              onClose={() => setError(null)}
            />
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label="Upload Excel workbook dropzone"
            onClick={handleDropzoneClick}
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 select-none ${
              isDragging
                ? "border-primary bg-primary-50/50 dark:bg-primary-950/20"
                : "border-default-300 hover:border-default-400 dark:border-default-700 dark:hover:border-default-600 bg-default-50/50 hover:bg-default-100/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsm,.xlsx"
              onChange={handleFileInputChange}
              className="sr-only"
              tabIndex={-1}
              disabled={loading}
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3">
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
                  className="max-w-md w-full mt-2"
                />
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <Chip
                  variant="flat"
                  color="primary"
                  startContent={<FileSpreadsheet className="w-4 h-4 ml-1" />}
                  onClose={handleClearFile}
                  className="max-w-full truncate"
                >
                  {selectedFile.name} ({formatBytes(selectedFile.size)})
                </Chip>
                <p className="text-xs text-default-400 mt-2">
                  Click or drag another file to replace
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-default-400 mb-3" />
                <p className="text-sm font-medium text-foreground">
                  Choose file or drag and drop
                </p>
                <p className="text-xs text-default-400 mt-1">
                  Supports .xls, .xlsm, .xlsx (up to 25 MB)
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </PageFade>
  );
};
