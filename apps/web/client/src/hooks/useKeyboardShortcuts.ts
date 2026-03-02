import { useEffect } from 'react';

interface ShortcutConfig {
  key: string; // 'k', 'n', 's', etc
  ctrl?: boolean;
  cmd?: boolean; // macOS
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const isCtrlOrCmd = (event.ctrlKey || event.metaKey) && (shortcut.ctrl || shortcut.cmd);
        const isShift = event.shiftKey === (shortcut.shift ?? false);
        const isAlt = event.altKey === (shortcut.alt ?? false);
        const isKey = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (isCtrlOrCmd && isShift && isAlt && isKey) {
          event.preventDefault();
          shortcut.callback();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Predefined shortcuts
export const SHORTCUTS = {
  SEARCH: { key: 'k', cmd: true, ctrl: true }, // Cmd+K or Ctrl+K
  NEW_CUSTOMER: { key: 'n', cmd: true, ctrl: true }, // Cmd+N or Ctrl+N
  SAVE: { key: 's', cmd: true, ctrl: true }, // Cmd+S or Ctrl+S
  ESCAPE: { key: 'Escape' }, // Escape
  ENTER: { key: 'Enter' }, // Enter
  DELETE: { key: 'Delete' }, // Delete
};
