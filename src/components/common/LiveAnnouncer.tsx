"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

interface AnnouncerContextValue {
  announce: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<number | undefined>(undefined);

  const announce = useCallback((next: string) => {
    window.clearTimeout(timeoutRef.current);
    setMessage("");
    timeoutRef.current = window.setTimeout(() => setMessage(next), 50);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useLiveAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useLiveAnnouncer must be used within LiveAnnouncerProvider");
  }
  return context;
}
