"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, XCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";

const API_BASE = "/api";

interface ModelServiceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  service?: ModelService | null;
}

export interface ModelService {
  name: string;
  description: string;
  provider: string;
  base_url: string;
  api_key?: string;
  selected_model: string;
  available_models: string[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  zhipu: "https://open.bigmodel.cn/api/coding/paas/v4",
  alibaba_bailian: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  ollama: "http://localhost:11434/v1",
};

export function ModelServiceDialog({ open, onClose, onSave, service }: ModelServiceDialogProps) {
  const { locale } = useLocale();
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("zhipu");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // 初始化表单
  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description);
      setProvider(service.provider);
      setBaseUrl(service.base_url);
      setApiKey(""); // API key不回显
      setSelectedModel(service.selected_model);
      setAvailableModels(service.available_models || []);
      setEnabled(service.enabled);
    } else {
      resetForm();
    }
  }, [service, open]);

  // 供应商变化时设置默认URL
  useEffect(() => {
    if (!isEdit && PROVIDER_DEFAULT_URLS[provider]) {
      setBaseUrl(PROVIDER_DEFAULT_URLS[provider]);
    }
  }, [provider, isEdit]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setProvider("zhipu");
    setBaseUrl(PROVIDER_DEFAULT_URLS["zhipu"]);
    setApiKey("");
    setSelectedModel("");
    setAvailableModels([]);
    setEnabled(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!baseUrl) {
      setTestResult({ success: false, message: locale === "zh" ? "请输入服务地址" : "Please enter service URL" });
      return;
    }

    if (provider !== "ollama" && !apiKey) {
      setTestResult({ success: false, message: locale === "zh" ? "请输入 API Key" : "Please enter API Key" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${API_BASE}/model-services/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          base_url: baseUrl,
          api_key: apiKey || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: data.message || (locale === "zh" ? "连接成功" : "Connection successful") });
        setAvailableModels(data.models || []);
        // 如果只有一个模型，自动选中
        if (data.models && data.models.length === 1) {
          setSelectedModel(data.models[0]);
        }
      } else {
        setTestResult({ success: false, message: data.message || (locale === "zh" ? "连接失败" : "Connection failed") });
        setAvailableModels([]);
      }
    } catch (error) {
      setTestResult({ success: false, message: locale === "zh" ? "请求失败，请检查网络" : "Request failed, please check network" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert(locale === "zh" ? "请输入服务名称" : "Please enter service name");
      return;
    }

    if (!selectedModel) {
      alert(locale === "zh" ? "请先测试连接并选择一个模型" : "Please test connection and select a model first");
      return;
    }

    setSaving(true);

    try {
      const url = isEdit ? `${API_BASE}/model-services/${service.name}` : `${API_BASE}/model-services`;
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, any> = {
        description,
        provider,
        base_url: baseUrl,
        selected_model: selectedModel,
        available_models: availableModels,
        enabled,
      };

      if (!isEdit) {
        body.name = name.trim();
      }

      // 只有在提供了 API key 时才发送
      if (apiKey) {
        body.api_key = apiKey;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const data = await response.json();
        alert(data.detail || (locale === "zh" ? "保存失败" : "Save failed"));
      }
    } catch (error) {
      alert(locale === "zh" ? "保存失败，请检查网络" : "Save failed, please check network");
    } finally {
      setSaving(false);
    }
  };

  const getProviderLabel = (p: string) => {
    switch (p) {
      case "zhipu":
        return locale === "zh" ? "智谱AI" : "Zhipu AI";
      case "alibaba_bailian":
        return locale === "zh" ? "阿里云百炼" : "Alibaba Bailian";
      case "ollama":
        return "Ollama";
      default:
        return p;
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {isEdit
                  ? t(locale, "editModelService")
                  : t(locale, "createModelService")}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* 服务名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(locale, "modelServiceName")}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(locale, "modelServiceNamePlaceholder")}
                disabled={isEdit}
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(locale, "modelServiceDescription")}
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={locale === "zh" ? "可选描述" : "Optional description"}
              />
            </div>

            {/* 供应商 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(locale, "modelProvider")}
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="zhipu">{getProviderLabel("zhipu")}</option>
                <option value="alibaba_bailian">{getProviderLabel("alibaba_bailian")}</option>
                <option value="ollama">{getProviderLabel("ollama")}</option>
              </select>
            </div>

            {/* 服务地址 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(locale, "modelServiceUrl")}
              </label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>

            {/* API Key - 仅智谱和百炼需要 */}
            {provider !== "ollama" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={isEdit ? (locale === "zh" ? "留空保持不变" : "Leave empty to keep unchanged") : (locale === "zh" ? "请输入 API Key" : "Enter API Key")}
                />
              </div>
            )}

            {/* 测试按钮 */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t(locale, "testing")}
                  </>
                ) : (
                  t(locale, "testConnection")
                )}
              </Button>

              {testResult && (
                <div
                  className={`flex items-center gap-1 text-sm ${
                    testResult.success
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* 模型选择 - 测试成功后显示 */}
            {availableModels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t(locale, "selectModel")}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t(locale, "pleaseSelectModel")}</option>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t(locale, "availableModelsCount").replace("{count}", String(availableModels.length))}
                </p>
              </div>
            )}

            {/* 启用开关 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label
                htmlFor="enabled"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {t(locale, "enableService")}
              </label>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t(locale, "cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !selectedModel}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t(locale, "save")}
                </>
              ) : (
                t(locale, "save")
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
