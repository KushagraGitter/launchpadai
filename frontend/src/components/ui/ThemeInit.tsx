"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";

export default function ThemeInit() {
  const resolved = useTheme((s) => s.resolved);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolved);
  }, [resolved]);

  return null;
}
