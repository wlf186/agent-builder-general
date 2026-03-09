"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/LocaleContext";

const API_BASE = "/api";

interface SkillUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function SkillUploadDialog({
  isOpen,
  onClose,
  onUploadSuccess,
}: SkillUploadDialogProps) {
  const { locale } = useLocale();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".zip")) {
        setSelectedFile(file);
        setUploadStatus("idle");
      } else {
        setUploadStatus("error");
        setUploadMessage(
          locale === "zh" ? "只支持 .zip 文件" : "Only .zip files are supported"
        );
      }
    }
  }, [locale]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".zip")) {
        setSelectedFile(file);
        setUploadStatus("idle");
      } else {
        setUploadStatus("error");
        setUploadMessage(
          locale === "zh" ? "只支持 .zip 文件" : "Only .zip files are supported"
        );
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus("idle");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/skills/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadStatus("success");
        setUploadMessage(
          data.message ||
            (locale === "zh" ? "上传成功" : "Upload successful")
        );
        setSelectedFile(null);
        onUploadSuccess();

        // Close dialog after success
        setTimeout(() => {
          onClose();
          setUploadStatus("idle");
        }, 1500);
      } else {
        setUploadStatus("error");
        setUploadMessage(
          data.detail || (locale === "zh" ? "上传失败" : "Upload failed")
        );
      }
    } catch (e) {
      console.error("Upload failed:", e);
      setUploadStatus("error");
      setUploadMessage(
        locale === "zh" ? "网络错误，请重试" : "Network error, please retry"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onClose();
      setSelectedFile(null);
      setUploadStatus("idle");
      setUploadMessage("");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden border border-white/10"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {locale === "zh" ? "上传技能包" : "Upload Skill Package"}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {locale === "zh"
                  ? "上传包含 SKILL.md 的 zip 文件"
                  : "Upload a zip file containing SKILL.md"}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Drop Zone */}
            <label
              className={cn(
                "relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/20 hover:border-white/40 hover:bg-white/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <Upload
                size={32}
                className={cn(
                  "mb-3",
                  isDragging ? "text-blue-400" : "text-gray-500"
                )}
              />
              <p className="text-sm text-gray-400 text-center">
                {locale === "zh"
                  ? "拖拽文件到此处，或点击选择"
                  : "Drag and drop, or click to select"}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {locale === "zh"
                  ? "只支持 .zip 文件"
                  : "Only .zip files are supported"}
              </p>
            </label>

            {/* Selected File */}
            {selectedFile && (
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-gray-300 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {/* Status Message */}
            {uploadStatus !== "idle" && (
              <div
                className={cn(
                  "mt-4 p-3 rounded-lg flex items-center gap-2",
                  uploadStatus === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                )}
              >
                {uploadStatus === "success" ? (
                  <CheckCircle size={16} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={16} className="text-red-400" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    uploadStatus === "success"
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {uploadMessage}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-white/[0.02]">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              {locale === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {locale === "zh" ? "上传中..." : "Uploading..."}
                </>
              ) : (
                <>
                  <Upload size={16} />
                  {locale === "zh" ? "上传" : "Upload"}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
