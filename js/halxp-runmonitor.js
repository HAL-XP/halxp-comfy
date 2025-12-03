import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.HALXP.RunMonitor",
    async setup() {
        console.log("[HALXP-RunMonitor] Initializing...");

        // --- CONSTANTS ---
        const ID_ENABLE  = "HALXP.RunMonitor.Enable";
        const ID_SUCCESS = "HALXP.RunMonitor.SuccessPath";
        const ID_ERROR   = "HALXP.RunMonitor.ErrorPath";

        // --- STATE & UI ELEMENTS ---
        let monitorBtn = null;
        let monitorDot = null;

        // --- 1. CORE LOGIC: VISUALS ---
        
        // Directly update the button based on the boolean passed to it
        function updateButtonVisuals(isEnabled) {
            if (!monitorBtn || !monitorDot) return;
            
            if (isEnabled) {
                // ACTIVE STATE (Green)
                monitorDot.style.backgroundColor = "#4CAF50"; 
                monitorDot.style.boxShadow = "0 0 6px #4CAF50";
                monitorBtn.style.color = "#fff"; 
                monitorBtn.style.borderColor = "#4CAF50";
                monitorBtn.title = "Monitor: ON";
            } else {
                // INACTIVE STATE (Gray/Default)
                monitorDot.style.backgroundColor = "#666"; 
                monitorDot.style.boxShadow = "none";
                monitorBtn.style.color = "var(--fg-color, #ccc)"; 
                monitorBtn.style.borderColor = "#d3c1c1ff";
                monitorBtn.title = "Monitor: OFF";
            }
        }

        // --- 2. CORE LOGIC: BACKEND SYNC ---

        function pushConfigToBackend() {
            // We can safely read all values here for the Python backend
            const config = {
                enabled: app.ui.settings.getSettingValue(ID_ENABLE, false),
                success_path: app.ui.settings.getSettingValue(ID_SUCCESS, ""),
                error_path: app.ui.settings.getSettingValue(ID_ERROR, "")
            };
            
            api.fetchApi("/halxp/update_config", {
                method: "POST",
                body: JSON.stringify(config)
            });
        }

        // --- 3. REGISTER SETTINGS ---
        
        app.ui.settings.addSetting({
            id: ID_ENABLE,
            name: "Enable External Monitoring",
            type: "boolean",
            defaultValue: false,
            category: ['HALXP-Comfy', 'Run Monitor', 'Enable'], 
            tooltip: "Enable to run scripts on workflow status change.",
            onChange: (value) => {
                // CRITICAL FIX: Use 'value' directly. Do not re-read from settings.
                updateButtonVisuals(value);
                pushConfigToBackend();
            }
        });

        app.ui.settings.addSetting({
            id: ID_SUCCESS,
            name: "Success Command Path",
            type: "text",
            defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Success'],
            tooltip: "Full path to a .bat/.sh to run on success.",
            onChange: pushConfigToBackend
        });

        app.ui.settings.addSetting({
            id: ID_ERROR,
            name: "Error Command Path",
            type: "text",
            defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Error'],
            tooltip: "Full path to a .bat/.sh to run on error.",
            onChange: pushConfigToBackend
        });

        // --- 4. UI BUTTON CREATION ---

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

            // CLICK HANDLER: 
            // We simply toggle the setting. The setting's onChange will handle the visuals.
            btn.onclick = (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                const current = app.ui.settings.getSettingValue(ID_ENABLE, false);
                app.ui.settings.setSettingValue(ID_ENABLE, !current);
            };

            return btn;
        }

        function injectButton() {
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
                
                // INITIAL SYNC: Read from memory once on creation
                const currentVal = app.ui.settings.getSettingValue(ID_ENABLE, false);
                updateButtonVisuals(currentVal);
            }
        }

        // --- 5. INITIALIZATION ---
        
        setInterval(injectButton, 500);

        // Safety Sync on load
        setTimeout(() => {
            const currentVal = app.ui.settings.getSettingValue(ID_ENABLE, false);
            updateButtonVisuals(currentVal);
            pushConfigToBackend();
        }, 2000);
    }
});