// hooks/usePresenceTracker.ts
import { useEffect } from "react";

interface PresenceTrackerProps {
  onEvent: (type: string, message: string, presenceState?: boolean) => void;
  enabled?: boolean;
}

export function usePresenceTracker({ onEvent, enabled = true }: PresenceTrackerProps) {
  useEffect(() => {
    if (!enabled) return;

    let windowIsUnfocused = false;

    const emit = (type: string, message: string, presenceState?: boolean) => {
      onEvent(type, message, presenceState);
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

    const handlePaste = () => {
      emit("CLIPBOARD_ACTION", "Candidate attempted to paste content.");
    };

    // 5. Context Menu (Right Click)
    const handleContextMenu = () => {
      onEvent("CONTEXT_MENU", "Candidate opened right-click context menu.");
    };

    // Event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [enabled, onEvent]);
}