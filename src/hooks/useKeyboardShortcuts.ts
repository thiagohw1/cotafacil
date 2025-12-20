import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
    onNew?: () => void;
    onSave?: () => void;
}

export const useKeyboardShortcuts = ({ onNew, onSave }: UseKeyboardShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // F5 to Create New
            if (event.code === "F5") {
                if (onNew) {
                    event.preventDefault();
                    onNew();
                }
            }

            // F9 to Save
            if (event.code === "F9") {
                if (onSave) {
                    event.preventDefault();
                    onSave();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onNew, onSave]);
};
