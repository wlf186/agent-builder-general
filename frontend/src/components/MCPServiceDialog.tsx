"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Server, Link, Key, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/lib/LocaleContext";

const API_BASE = "/api";

interface MCPService {
  name: string;
  description: string;
  connection_type: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
  url?: string;
  auth_type?: string;
  headers?: Record<string, string>;
}

interface MCPServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  service?: MCPService | null; // 如果有值则为编辑模式
}

export function MCPServiceDialog({ isOpen, onClose, onSave, service }: MCPServiceDialogProps) {
  const { locale } = useLocale();
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  // SSE 配置 (唯一支持的连接方式)
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "apikey">("none");
  const [authValue, setAuthValue] = useState("");
  const [headers, setHeaders] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description || "");
      setEnabled(service.enabled);
      setUrl(service.url || "");
      setAuthType((service.auth_type as "none" | "bearer" | "apikey") || "none");
      setAuthValue("");
      setHeaders(JSON.stringify(service.headers || {}, null, 2));
    } else {
      // 重置表单
      setName("");
      setDescription("");
      setEnabled(true);
      setUrl("");
      setAuthType("none");
      setAuthValue("");
      setHeaders("{}");
    }
    setError("");
  }, [service, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(locale === "zh" ? "请输入服务名称" : "Service name is required");
      return;
    }

    if (!url.trim()) {
      setError(locale === "zh" ? "请输入服务URL" : "URL is required");
      return;
    }

    // 验证 JSON 格式
    let headersObj = {};
    try {
      headersObj = headers.trim() ? JSON.parse(headers) : {};
    } catch {
      setError(locale === "zh" ? "请求头JSON格式错误" : "Invalid JSON format for headers");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        description,
        connection_type: "sse",  // 只支持 SSE
        enabled,
        url: url,
        auth_type: authType,
        auth_value: authValue || null,
        headers: headersObj,
      };

      const url_path = isEdit ? `/api/mcp-services/${service.name}` : "/api/mcp-services";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(`${API_BASE}${url_path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSave();
        onClose();
      } else {
        setError(data.detail || (locale === "zh" ? "保存失败" : "Save failed"));
      }
    } catch {
      setError(locale === "zh" ? "网络错误" : "Network error");
    } finally {
      setIsLoading(false);
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
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Server size={20} className="text-white" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {isEdit
                        ? (locale === "zh" ? "编辑 MCP 服务" : "Edit MCP Service")
                        : (locale === "zh" ? "创建 MCP 服务" : "Create MCP Service")}
                  </h2>
                </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Settings size={14} />
                  <span>{locale === "zh" ? "基本信息" : "Basic Info"}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {locale === "zh" ? "服务名称" : "Service Name"} *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={locale === "zh" ? "例如：weather-api" : "e.g., weather-api"}
                    disabled={isEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {locale === "zh" ? "描述" : "Description"}
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={locale === "zh" ? "描述这个服务的功能..." : "Describe this service..."}
                    rows={2}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-sm text-gray-300">
                    {locale === "zh" ? "启用此服务" : "Enable this service"}
                  </span>
                </label>
              </div>

              {/* SSE 配置 - 唯一支持的连接方式 */}
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Link size={14} />
                  <span>{locale === "zh" ? "SSE 连接配置" : "SSE Connection Config"}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {locale === "zh" ? "服务 URL" : "Service URL"} *
                  </label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:20882/calculator"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {locale === "zh"
                      ? "MCP 服务的 HTTP 端点地址"
                      : "HTTP endpoint URL of the MCP service"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {locale === "zh" ? "认证类型" : "Auth Type"}
                  </label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as "none" | "bearer" | "apikey")}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="none">{locale === "zh" ? "无认证" : "None"}</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apikey">API Key</option>
                  </select>
                </div>

                {authType !== "none" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Key size={14} />
                        {authType === "bearer" ? "Bearer Token" : "API Key"}
                      </div>
                    </label>
                    <Input
                      type="password"
                      value={authValue}
                      onChange={(e) => setAuthValue(e.target.value)}
                      placeholder={isEdit ? (locale === "zh" ? "留空保持不变" : "Leave empty to keep") : ""}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {locale === "zh" ? "自定义请求头 (JSON)" : "Custom Headers (JSON)"}
                  </label>
                  <Textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    placeholder='{"X-Custom-Header": "value"}'
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  {locale === "zh" ? "取消" : "Cancel"}
                </Button>
                <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Server size={16} />
                  )}
                  {locale === "zh" ? "保存" : "Save"}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
