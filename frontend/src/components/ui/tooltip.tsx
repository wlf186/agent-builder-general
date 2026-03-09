"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  content: ReactNode;
  iconSize?: number;
  className?: string;
}

export function Tooltip({ content, iconSize = 12, className = "" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = 256; // w-64 = 16rem = 256px

      // 计算位置，确保不超出视口
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 16;
      }

      setPosition({
        top: rect.bottom + 8, // 8px = mt-2
        left: Math.max(16, left),
      });
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={iconRef}
        className={`inline-block ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <HelpCircle size={iconSize} className="text-gray-500 cursor-help" />
      </div>

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[9999]"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            <div className="bg-gray-800 text-gray-200 text-xs rounded-lg px-3 py-2 shadow-lg w-64 whitespace-pre-wrap">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
