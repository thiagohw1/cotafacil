import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/apply-migrations";
// PWA Registration
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm('Nova versão disponível. Recarregar?')) {
            updateSW(true);
        }
    },
});

createRoot(document.getElementById("root")!).render(<App />);
