"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export function usePwaInstall(): {
  canInstall: boolean;
  installed: boolean;
  showIosGuidance: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // Lazy initializer runs during render (server and first client render both
  // safely return false pre-hydration), so no effect-time setState is needed
  // just to read this on mount.
  const [installed, setInstalled] = useState(() => isStandaloneDisplayMode());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      trackEvent("pwa_install_prompt_shown");
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      trackEvent("pwa_installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null && !installed,
    installed,
    showIosGuidance: !installed && deferredPrompt === null && isIosSafari(),
    promptInstall,
  };
}
