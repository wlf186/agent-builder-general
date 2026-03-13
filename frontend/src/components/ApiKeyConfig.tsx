"use client";

import { useState } from "react";
import { Key, Eye, EyeOff, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";

const STORAGE_TYPES = {
  ENV: "env",
  ENCRYPTED: "encrypted",
  PLAINTEXT: "plaintext",
} as const;

type StorageType = (typeof STORAGE_TYPES)[keyof typeof STORAGE_TYPES];

interface ApiKeyConfigProps {
  serviceName: string;
  currentValue?: string;
  isFromEnv?: boolean; // 是否已从环境变量加载
  onValueChange: (value: string, storageType: StorageType) => void;
  disabled?: boolean;
}

/**
 * API密钥安全配置组件
 *
 * 功能：
 * - 支持三种存储方式：环境变量、加密存储、明文存储
 * - 显示安全提示
 * - 密码遮罩/显示切换
 * - 环境变量配置示例
 */
export function ApiKeyConfig({
  serviceName,
  currentValue,
  isFromEnv = false,
  onValueChange,
  disabled = false,
}: ApiKeyConfigProps) {
  const { locale } = useLocale();
  const [showValue, setShowValue] = useState(false);
  const [storageType, setStorageType] = useState<StorageType>(
    isFromEnv ? STORAGE_TYPES.ENV : STORAGE_TYPES.PLAINTEXT
  );
  const [inputValue, setInputValue] = useState(currentValue || "");

  // 环境变量名称
  const envVarName = `${serviceName}_API_KEY`;

  // 处理存储方式变化
  const handleStorageTypeChange = (newType: StorageType) => {
    setStorageType(newType);
    if (newType === STORAGE_TYPES.ENV) {
      onValueChange("", STORAGE_TYPES.ENV);
    } else {
      onValueChange(inputValue, newType);
    }
  };

  // 处理密钥输入
  const handleInputChange = (value: string) => {
    setInputValue(value);
    onValueChange(value, storageType);
  };

  // 获取存储方式的配置
  const getStorageTypeConfig = (type: StorageType) => {
    switch (type) {
      case STORAGE_TYPES.ENV:
        return {
          title: locale === "zh" ? "环境变量（推荐）" : "Environment Variable (Recommended)",
          description: locale === "zh"
            ? "最安全的方式，密钥永不写入配置文件"
            : "Safest option, key never written to config file",
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          icon: CheckCircle2,
        };
      case STORAGE_TYPES.ENCRYPTED:
        return {
          title: locale === "zh" ? "加密存储" : "Encrypted Storage",
          description: locale === "zh"
            ? "密钥加密后存储，需要设置加密密钥"
            : "Key encrypted before storage, requires encryption key",
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          icon: Key,
        };
      case STORAGE_TYPES.PLAINTEXT:
        return {
          title: locale === "zh" ? "明文存储（不推荐）" : "Plaintext Storage (Not Recommended)",
          description: locale === "zh"
            ? "密钥以明文存储，存在安全风险"
            : "Key stored in plaintext, security risk",
          color: "text-amber-400",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
          icon: AlertTriangle,
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* 存储方式选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {locale === "zh" ? "存储方式" : "Storage Method"}
        </label>
        <div className="space-y-2">
          {(Object.keys(STORAGE_TYPES) as Array<keyof typeof STORAGE_TYPES>).map((type) => {
            const config = getStorageTypeConfig(STORAGE_TYPES[type]);
            const Icon = config.icon;
            const isSelected = storageType === STORAGE_TYPES[type];

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleStorageTypeChange(STORAGE_TYPES[type])}
                disabled={disabled}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? `${config.bgColor} ${config.borderColor} border-2`
                    : "border-white/10 bg-transparent hover:bg-white/5"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? config.color : "text-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isSelected ? config.color : "text-gray-300"}`}>
                      {config.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
                  </div>
                  {isSelected && (
                    <div className={`w-4 h-4 rounded-full border-2 ${config.color} flex items-center justify-center`}>
                      <div className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")}`} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 环境变量配置说明 */}
      {storageType === STORAGE_TYPES.ENV && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-300 mb-2">
                {locale === "zh" ? "环境变量配置" : "Environment Variable Setup"}
              </p>
              <div className="space-y-2">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">
                    {locale === "zh" ? "在服务器设置以下环境变量：" : "Set the following environment variable on your server:"}
                  </p>
                  <code className="text-sm text-emerald-300 font-mono">{envVarName}=your_api_key_here</code>
                </div>
                <p className="text-xs text-gray-400">
                  {locale === "zh"
                    ? "设置后，系统将自动从环境变量读取密钥，无需在界面上输入。"
                    : "After setting, the system will automatically read the key from the environment variable."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加密存储说明 */}
      {storageType === STORAGE_TYPES.ENCRYPTED && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-2">
                {locale === "zh" ? "加密存储配置" : "Encrypted Storage Setup"}
              </p>
              <p className="text-xs text-gray-400">
                {locale === "zh"
                  ? "密钥将被加密后存储。首次使用需要设置加密主密钥（环境变量 SECRET_ENCRYPTION_KEY）。"
                  : "The key will be encrypted before storage. First-time use requires setting an encryption master key (environment variable SECRET_ENCRYPTION_KEY)."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 明文存储警告 */}
      {storageType === STORAGE_TYPES.PLAINTEXT && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300 mb-2">
                {locale === "zh" ? "安全警告" : "Security Warning"}
              </p>
              <p className="text-xs text-gray-400">
                {locale === "zh"
                  ? "明文存储的密钥可能被Git提交或泄露。建议使用环境变量存储敏感信息。"
                  : "Plaintext stored keys may be committed to Git or leaked. Using environment variables is recommended for sensitive information."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Key 输入框（仅非环境变量模式） */}
      {storageType !== STORAGE_TYPES.ENV && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showValue ? "text" : "password"}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              placeholder={locale === "zh" ? "请输入 API Key" : "Enter API Key"}
              className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              disabled={disabled || !inputValue}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white disabled:opacity-50"
            >
              {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isFromEnv && (
            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={12} />
              {locale === "zh"
                ? `当前从环境变量 ${envVarName} 加载`
                : `Currently loaded from environment variable ${envVarName}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
