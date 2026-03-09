"use client";

import { ReactNode } from "react";
import { LocaleProvider } from "@/lib/LocaleContext";

export function LocaleWrapper({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
