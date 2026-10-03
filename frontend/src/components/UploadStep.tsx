import React, { useState } from "react";
import { uploadSheet } from "../api";
import { useAppStore } from "../store";

export const UploadStep: React.FC = () => {
  const { setSession, setLoading, setError, loading } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xls", "xlsm", "xlsx"].includes(ext || "")) {
      setError("Please select a valid Excel workbook (.xls, .xlsm, or .xlsx).");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const session = await uploadSheet(file);
      setSession(session);
      // update URL with sid
      const url = new URL(window.location.href);
      url.searchParams.set("sid", session.session_id);
      window.history.pushState({}, "", url.toString());
    } catch (err: any) {
      setError(err?.message || "Failed to analyze workbook");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
        FK
      </div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-2">Upload Flipkart T-Shirt Workbook</h2>
      <p className="text-slate-500 mb-6 text-sm">
        Upload your draft <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">.xls</code>,{" "}
        <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">.xlsm</code>, or{" "}
        <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">.xlsx</code> sheet.
        The tool detects stubs and helps you fill all 4 size rows without breaking Excel macros.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
        }`}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <input
          id="file-upload"
          type="file"
          accept=".xls,.xlsm,.xlsx"
          onChange={handleChange}
          className="hidden"
          disabled={loading}
        />
        {loading ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium text-slate-600">Analyzing workbook structure & detecting designs...</p>
          </div>
        ) : (
          <div>
            <svg
              className="w-10 h-10 text-slate-400 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Click to choose file or drag and drop</p>
            <p className="text-xs text-slate-400 mt-1">Supports up to 25 MB</p>
          </div>
        )}
      </div>
    </div>
  );
};
