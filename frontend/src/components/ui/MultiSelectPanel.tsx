"use client";

import { useState, useMemo, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/LocaleContext";

// Theme color configuration
export type ThemeColor = "emerald" | "indigo" | "blue" | "purple" | "amber" | "red";

export interface Badge {
  label: string;
  variant?: "default" | "primary" | "secondary";
}

export interface MultiSelectPanelProps<T> {
  // Display configuration
  title: string;
  icon: ReactNode;
  color: ThemeColor;
  hint?: string;

  // Data
  items: T[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;

  // Item rendering
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  getDescription: (item: T) => string;
  getBadges?: (item: T) => Badge[];
  getExtraInfo?: (item: T) => string;  // Extra info line (e.g., "2 skills  1 service")
  getItemIcon?: (item: T) => ReactNode;

  // Optional features
  searchPlaceholder?: string;
  emptyMessage?: string;
  onCreateNew?: () => void;
  onItemClick?: (item: T) => void;

  // State
  disabled?: boolean;
  loading?: boolean;
  defaultExpanded?: boolean;
}

// Color theme mapping
const colorClasses: Record<ThemeColor, {
  accent: string;
  bg: string;
  border: string;
  text: string;
  iconBg: string;
  checkbox: string;
}> = {
  emerald: {
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
    iconBg: "bg-emerald-500/20",
    checkbox: "accent-emerald-500",
  },
  indigo: {
    accent: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    text: "text-indigo-300",
    iconBg: "bg-indigo-500/20",
    checkbox: "accent-indigo-500",
  },
  blue: {
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-300",
    iconBg: "bg-blue-500/20",
    checkbox: "accent-blue-500",
  },
  purple: {
    accent: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-300",
    iconBg: "bg-purple-500/20",
    checkbox: "accent-purple-500",
  },
  amber: {
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-300",
    iconBg: "bg-amber-500/20",
    checkbox: "accent-amber-500",
  },
  red: {
    accent: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-300",
    iconBg: "bg-red-500/20",
    checkbox: "accent-red-500",
  },
};

export function MultiSelectPanel<T>({
  title,
  icon,
  color,
  hint,
  items,
  selectedIds,
  onChange,
  getId,
  getTitle,
  getDescription,
  getBadges,
  getExtraInfo,
  getItemIcon,
  searchPlaceholder = "...",
  emptyMessage = "...",
  onCreateNew,
  onItemClick,
  disabled = false,
  loading = false,
  defaultExpanded = false,
}: MultiSelectPanelProps<T>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");
  const { locale } = useLocale();
  const zh = locale === "zh";

  const theme = colorClasses[color];

  // Get selected items details
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.includes(getId(item)));
  }, [items, selectedIds, getId]);

  // Filter available items (exclude selected, apply search)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedIds.includes(getId(item))) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          getTitle(item).toLowerCase().includes(query) ||
          getDescription(item).toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, selectedIds, searchQuery, getId, getTitle, getDescription]);

  // Handle toggle selection
  const handleToggle = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  // Handle remove from selected
  const handleRemove = (id: string) => {
    if (disabled) return;
    onChange(selectedIds.filter((i) => i !== id));
  };

  return (
    <Card className="overflow-hidden border-white/[0.08] bg-white/[0.02]">
      {/* Header */}
      <div
        className={cn(
          "px-5 py-4 border-b border-white/[0.05] flex items-center gap-3 bg-white/[0.02] cursor-pointer transition-colors",
          !disabled && "hover:bg-white/[0.04]"
        )}
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
      >
        <span className={theme.accent}>{icon}</span>
        <span className="font-medium text-sm text-gray-300 flex-1">{title}</span>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <span className={cn("text-xs px-2 py-0.5 rounded-lg", theme.bg, theme.accent)}>
              {selectedIds.length}
            </span>
          )}
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-5 space-y-4">
              {/* Hint */}
              {hint && (
                <div className={cn("flex items-start gap-2 p-3 rounded-lg", theme.bg, theme.border, "border")}>
                  <span className={theme.accent}>💡</span>
                  <div className="text-xs text-gray-400">{hint}</div>
                </div>
              )}

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">{zh ? "已选择" : "Selected"}</div>
                  <div className="space-y-2">
                    {selectedItems.map((item) => {
                      const id = getId(item);
                      const badges = getBadges?.(item) || [];
                      return (
                        <div
                          key={id}
                          className={cn("flex items-start gap-3 p-3 rounded-lg", theme.bg, theme.border, "border")}
                        >
                          {getItemIcon && (
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", theme.iconBg)}>
                              {getItemIcon(item)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("font-medium text-sm", theme.text)}>
                                {getTitle(item)}
                              </span>
                              {badges.map((badge, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                              {getDescription(item)}
                            </p>
                          </div>
                          {onItemClick && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onItemClick(item)}
                              disabled={disabled}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                            >
                              👁️
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(id)}
                            disabled={disabled}
                            className="h-7 w-7 p-0 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search */}
              {filteredItems.length > 0 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-9 h-9 bg-white/5 border-white/10 text-sm text-white placeholder:text-gray-600"
                  />
                </div>
              )}

              {/* Available Items */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                    {icon}
                  </div>
                  <p className="text-sm text-gray-500">
                    {searchQuery ? (zh ? "没有找到匹配项" : "No matches found") : emptyMessage}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {filteredItems.map((item) => {
                    const id = getId(item);
                    const badges = getBadges?.(item) || [];
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.04]",
                          "bg-white/[0.02] border-white/[0.05]"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggle(id)}
                          disabled={disabled}
                          className={cn("mt-0.5 w-4 h-4 rounded flex-shrink-0", theme.checkbox)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-200">
                              {getTitle(item)}
                            </span>
                            {badges.map((badge, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                                {badge.label}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                            {getDescription(item)}
                          </p>
                          {/* Extra info line (skills, services count) */}
                          {getExtraInfo?.(item) && (
                            <div className="text-[10px] text-gray-600 mt-2">
                              {getExtraInfo(item)}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Create New Button */}
              {onCreateNew && (
                <button
                  onClick={onCreateNew}
                  disabled={disabled}
                  className={cn(
                    "w-full p-3 rounded-lg border border-dashed border-white/10",
                    "text-sm text-gray-500 hover:text-gray-300 hover:border-white/20",
                    "flex items-center justify-center gap-2 transition-colors",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Plus size={14} />
                  {zh ? "新建" : "Create New"}
                </button>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
