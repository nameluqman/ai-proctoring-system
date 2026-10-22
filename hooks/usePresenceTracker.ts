// hooks/usePresenceTracker.ts
import { useEffect } from "react";

interface PresenceTrackerProps {
  onEvent: (type: string, message: string, presenceState?: boolean) => void;
}

export function usePresenceTracker({ onEvent }: PresenceTrackerProps) {
  useEffect(() => {
    const lastAiSignalRef = { current: 0 };
    let windowIsUnfocused = false;

    const emit = (type: string, message: string, presenceState?: boolean) => {
      onEvent(type, message, presenceState);
    };

    const triggerAiListening = () => {
      const now = Date.now();
      if (now - lastAiSignalRef.current < 3000) {
        return;
      }

      lastAiSignalRef.current = now;
      onEvent("AI_LISTENING_DETECTED", "Possible external AI solver or screen reader activity detected", false);
    };

    // 1. Tab switch / Visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        emit("TAB_SWITCH", "Candidate switched tab or minimized window.", false);
      } else {
        emit("TAB_RETURN", "Candidate returned to assessment tab.", true);
      }
    };

    // 2. Window Unfocus / Focus
    const handleBlur = () => {
      if (!document.hidden && !windowIsUnfocused) {
        windowIsUnfocused = true;
        emit("WINDOW_UNFOCUS", "Assessment window lost focus while its tab remained visible.", false);
      }
    };

    const handleFocus = () => {
      if (windowIsUnfocused) {
        windowIsUnfocused = false;
        emit("WINDOW_FOCUS", "Candidate refocused assessment window.", true);
      }
    };

    // 3. Mouse Moved Out of Window / Returned
    const handleMouseLeave = (e: MouseEvent) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        emit("MOUSE_DEPARTURE", "Candidate moved cursor out of browser window.", false);
      }
    };

    const handleMouseEnter = () => {
      emit("MOUSE_ENTER", "Candidate returned cursor inside browser window.", true);
    };

    // 4. Clipboard copy/paste attempts
    const handleCopy = () => {
      emit("CLIPBOARD_ACTION", "Candidate attempted to copy text.");
    };

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData?.types ?? [];
      if (clipboardData.includes("text/plain") || clipboardData.includes("text/html")) {
        triggerAiListening();
      }
      emit("CLIPBOARD_ACTION", "Candidate attempted to paste content.");
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() ?? "";
      if (!selectedText.trim()) return;

      const selectionWindow = document.body.dataset.selectionScanWindow ?? "";
      if (selectionWindow === "rapid") {
        triggerAiListening();
      }
    };

    // 5. Context Menu (Right Click)
    const handleContextMenu = () => {
      onEvent("CONTEXT_MENU", "Candidate opened right-click context menu.");
    };

    // 6. Browser Extension DOM Injection Detection
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const extensionKeywords = [
              "grammarly",
              "copilot",
              "chatgpt",
              "extension",
              "ai-assistant",
              "solver",
              "screen-reader",
              "screenreader",
              "overlay",
            ];

            const idText = (node.id || "").toLowerCase();
            const classText = (node.className?.toString() || "").toLowerCase();
            const styleText = (node.getAttribute("style") || "").toLowerCase();
            const textContent = (node.textContent || "").toLowerCase();
            const matchesIdOrClass = extensionKeywords.some(
              (kw) => idText.includes(kw) || classText.includes(kw) || textContent.includes(kw)
            );

            const hiddenOverlayStyle = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|position\s*:\s*fixed|width\s*:\s*1px|height\s*:\s*1px|z-index\s*:\s*99999/i;
            const suspiciousOverlay = hiddenOverlayStyle.test(styleText) || node.getBoundingClientRect().width < 3;

            if (matchesIdOrClass || suspiciousOverlay) {
              triggerAiListening();
            }

            if (matchesIdOrClass) {
              onEvent(
                "EXTENSION_DETECTED",
                `External browser tool/extension element detected (<${node.tagName.toLowerCase()}>).`
              );
            }
          }
        });
      });
    });

    // Attach DOM Mutation Observer
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    const selectionScanWindow = window.setInterval(() => {
      const selection = window.getSelection();
      const selectionText = selection?.toString() ?? "";

      if (!selectionText.trim()) return;

      const now = Date.now();
      const lastSelectionAt = Number(document.body.dataset.selectionLastScanAt || 0);
      if (lastSelectionAt && now - lastSelectionAt < 1200) {
        document.body.dataset.selectionScanWindow = "rapid";
      }

      document.body.dataset.selectionLastScanAt = String(now);
    }, 500);

    // Event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      observer.disconnect();
      window.clearInterval(selectionScanWindow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [onEvent]);
}