import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.HALXP.RunMonitor",
    async setup() {
        console.log("[HALXP-RunMonitor] Initializing...");

        // --- CONSTANTS ---
        const ID_DISPLAY = "HALXP.RunMonitor.DisplayButton";
        const ID_ENABLE  = "HALXP.RunMonitor.Enable";
        const ID_SUCCESS = "HALXP.RunMonitor.SuccessPath";
        const ID_ERROR   = "HALXP.RunMonitor.ErrorPath";

        // --- STATE & UI ELEMENTS ---
        let monitorBtn = null;
        let monitorDot = null;

        // --- 1. CORE LOGIC ---
        
        function updateButtonVisuals(isEnabled) {
            if (!monitorBtn || !monitorDot) return;
            if (isEnabled) {
                // Green (ON)
                monitorDot.style.backgroundColor = "#4CAF50"; 
                monitorDot.style.boxShadow = "0 0 6px #4CAF50";
                monitorBtn.style.color = "#fff"; 
                monitorBtn.style.borderColor = "#4CAF50";
                monitorBtn.title = "Monitor: ON";
            } else {
                // Gray (OFF)
                monitorDot.style.backgroundColor = "#666"; 
                monitorDot.style.boxShadow = "none";
                monitorBtn.style.color = "var(--fg-color, #ccc)"; 
                monitorBtn.style.borderColor = "#d3c1c1ff";
                monitorBtn.title = "Monitor: OFF";
            }
        }

        // UPDATED: Now accepts an optional override for the enabled state
        function pushConfigToBackend(enabledOverride) {
            // If an override is provided (from onChange), use it.
            // Otherwise, fall back to reading the setting (for init/manual calls).
            let isEnabled;
            if (enabledOverride !== undefined && enabledOverride !== null) {
                isEnabled = enabledOverride;
            } else {
                isEnabled = app.ui.settings.getSettingValue(ID_ENABLE, false);
            }

            const config = {
                enabled: isEnabled,
                success_path: app.ui.settings.getSettingValue(ID_SUCCESS, ""),
                error_path: app.ui.settings.getSettingValue(ID_ERROR, "")
            };
            
            // Send to Python
            api.fetchApi("/halxp/update_config", {
                method: "POST",
                body: JSON.stringify(config)
            });
        }

        // --- 2. UI HELPERS ---

        function removeButton() {
            if (monitorBtn) {
                monitorBtn.remove();
                monitorBtn = null;
                monitorDot = null;
            }
        }

        function createButton() {
            const btn = document.createElement("button");
            btn.textContent = "Monitor";
            btn.id = "halxp-monitor-btn"; 
            btn.style.cssText = `
                position: relative; display: inline-flex; align-items: center; justify-content: center;
                padding: 0 10px; margin: 0 4px; background-color: var(--comfy-input-bg, #333);
                color: var(--fg-color, #fff); border: 1px solid var(--border-color, #555);
                border-radius: 4px; cursor: pointer; font-family: sans-serif; font-size: 13px;
                font-weight: 600; flex-shrink: 0; white-space: nowrap; z-index: 9999; pointer-events: auto;
                border: 1px solid #d3c1c1ff; 
            `;
            const d = document.createElement("span");
            d.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background-color: #666; margin-right: 8px; display: inline-block; flex-shrink: 0;`;
            btn.prepend(d);
            monitorDot = d;

            btn.onclick = (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                const current = app.ui.settings.getSettingValue(ID_ENABLE, false);
                app.ui.settings.setSettingValue(ID_ENABLE, !current);
            };
            return btn;
        }

        function injectButton() {
            const shouldDisplay = app.ui.settings.getSettingValue(ID_DISPLAY, true);
            if (!shouldDisplay) { removeButton(); return; }
            if (document.getElementById("halxp-monitor-btn")) return;

            const allButtons = Array.from(document.querySelectorAll("button"));
            const targetBtn = allButtons.find(b => {
                if (!b.offsetParent) return false;
                const text = b.innerText.trim();
                return text === "Manager" || text === "ComfyUI Manager" || text === "Focus";
            });

            if (targetBtn && targetBtn.parentNode) {
                monitorBtn = createButton();
                const h = targetBtn.offsetHeight;
                monitorBtn.style.height = h > 0 ? `${h}px` : "28px";
                targetBtn.parentNode.insertBefore(monitorBtn, targetBtn);
                
                // Visual Sync
                updateButtonVisuals(app.ui.settings.getSettingValue(ID_ENABLE, false));
            }
        }

        // --- 3. REGISTER SETTINGS ---

        app.ui.settings.addSetting({
            id: ID_DISPLAY, name: "Display Monitor Button", type: "boolean", defaultValue: true,
            category: ['HALXP-Comfy', 'Run Monitor', 'Display'],
            onChange: (value) => { value ? injectButton() : removeButton(); }
        });
        
        app.ui.settings.addSetting({
            id: ID_ENABLE, name: "Enable External Monitoring", type: "boolean", defaultValue: false,
            category: ['HALXP-Comfy', 'Run Monitor', 'Enable'], 
            onChange: (value) => { 
                updateButtonVisuals(value); 
                // PASS VALUE DIRECTLY HERE to prevent race condition
                pushConfigToBackend(value); 
            }
        });

        app.ui.settings.addSetting({
            id: ID_SUCCESS, name: "Success Command Path", type: "text", defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Success'], 
            // We pass undefined here so it reads from settings, as string updates are usually slower/safer
            onChange: () => pushConfigToBackend() 
        });

        app.ui.settings.addSetting({
            id: ID_ERROR, name: "Error Command Path", type: "text", defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Error'], 
            onChange: () => pushConfigToBackend()
        });

        // --- 4. INITIALIZATION ---
        
        setInterval(injectButton, 500);

        // --- FORCE SYNC ON LOAD ---
        setTimeout(() => {
             const isEnabled = app.ui.settings.getSettingValue(ID_ENABLE, false);
             updateButtonVisuals(isEnabled);
             pushConfigToBackend(isEnabled); // Pass explicit value
             console.log("[HALXP-RunMonitor] Force-synced config to backend.");
        }, 100);
    }
});