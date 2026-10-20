import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Download, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { downloadWorkbookFile } from "../api";
import { toast } from "../ui/ToastProvider";

interface ReportPanelProps {
  report: any;
  downloadUrl: string;
  filename?: string;
  onReset: () => void;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({
  report,
  downloadUrl,
  filename,
  onReset,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadWorkbookFile(downloadUrl, filename);
      toast.success("Workbook downloaded successfully!");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error(err?.message || "Failed to download workbook");
    } finally {
      setIsDownloading(false);
    }
  };

  const displayFilename = filename
    ? filename.toLowerCase().endsWith(".xls")
      ? filename
      : `${filename.replace(/\.[^/.]+$/, "")}.xls`
    : ".xls";

  return (
    <div className="max-w-3xl mx-auto my-6 bg-content1 border border-divider rounded-[14px] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-600 dark:bg-emerald-700 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
            Workbook Generated Successfully
          </h2>
          <p className="text-emerald-100 text-xs mt-1">
            Native BIFF8 .xls workbook complete with all 10 sheets, dropdown validations, and macros intact.
          </p>
        </div>
        <Button
          color="default"
          size="sm"
          isLoading={isDownloading}
          onPress={handleDownload}
          startContent={!isDownloading && <Download className="w-4 h-4 text-emerald-800" />}
          className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-[10px] px-4 h-9 shrink-0 shadow-xs"
        >
          {isDownloading ? "Downloading..." : `Download ${displayFilename}`}
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-content2 rounded-xl border border-divider text-center">
            <div className="text-2xl font-bold text-foreground">{report.rows_written || 0}</div>
            <div className="text-xs font-semibold text-default-400 uppercase mt-0.5">Rows Written</div>
          </div>
          <div className="p-4 bg-content2 rounded-xl border border-divider text-center">
            <div className="text-2xl font-bold text-emerald-500">{report.ready_designs_count || 0}</div>
            <div className="text-xs font-semibold text-default-400 uppercase mt-0.5">Designs Filled</div>
          </div>
          <div className="p-4 bg-content2 rounded-xl border border-divider text-center">
            <div className="text-2xl font-bold text-amber-500">
              {(report.designs_count || 0) - (report.ready_designs_count || 0)}
            </div>
            <div className="text-xs font-semibold text-default-400 uppercase mt-0.5">Untouched Stubs</div>
          </div>
          <div className="p-4 bg-content2 rounded-xl border border-divider text-center">
            <div className="text-2xl font-bold text-primary">33 / 33</div>
            <div className="text-xs font-semibold text-default-400 uppercase mt-0.5">Macro Parts OK</div>
          </div>
        </div>

        {/* Mandatory Fast Validate Notice */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong className="font-semibold">Next Step: </strong>
            Open in Excel &rarr; navigate to{" "}
            <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono font-semibold">t_shirt</code> sheet &rarr; press{" "}
            <kbd className="bg-content1 border border-divider px-1.5 py-0.5 rounded font-mono font-semibold text-foreground shadow-2xs">
              Ctrl + Shift + S
            </kbd>{" "}
            (Fast Validate) &rarr; upload to Flipkart Seller Portal.
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <Button
            size="sm"
            variant="light"
            onPress={onReset}
            startContent={<ArrowLeft className="w-3.5 h-3.5" />}
            className="text-xs text-default-500 hover:text-foreground font-medium"
          >
            Back to Designs
          </Button>

          <Button
            size="sm"
            color="primary"
            variant="flat"
            isLoading={isDownloading}
            onPress={handleDownload}
            startContent={!isDownloading && <Download className="w-3.5 h-3.5" />}
            className="text-xs font-semibold"
          >
            {isDownloading ? "Downloading..." : `Download ${filename || ".xls"}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
