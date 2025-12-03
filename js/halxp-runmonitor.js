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

        // --- 1. CORE LOGIC: SYNC & UPDATE ---
        
        // Updates the visuals of the button (Green/Gray) based on state
        function updateButtonVisuals(enabled) {
            if (!monitorBtn || !monitorDot) return;
            
            if (enabled) {
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
                monitorBtn.style.borderColor = "#d3c1c1ff"; // Matches Focus default border
                monitorBtn.title = "Monitor: OFF";
            }
        }

        // Sends config to Python backend AND updates UI
        function syncConfigToBackend() {
            const enabled = app.ui.settings.getSettingValue(ID_ENABLE, false);
            const config = {
                enabled: enabled,
                success_path: app.ui.settings.getSettingValue(ID_SUCCESS, ""),
                error_path: app.ui.settings.getSettingValue(ID_ERROR, "")
            };
            
            // 1. Update the UI Button immediately
            updateButtonVisuals(enabled);

            // 2. Send to Backend
            api.fetchApi("/halxp/update_config", {
                method: "POST",
                body: JSON.stringify(config)
            });
        }

        // --- 2. REGISTER SETTINGS ---
        
        app.ui.settings.addSetting({
            id: ID_ENABLE,
            name: "Enable External Monitoring",
            type: "boolean",
            defaultValue: false,
            category: ['HALXP-Comfy', 'Run Monitor', 'Enable'], 
            tooltip: "Enable to run scripts on workflow status change.",
            onChange: syncConfigToBackend // Triggers when changed via Menu OR Button
        });

        app.ui.settings.addSetting({
            id: ID_SUCCESS,
            name: "Success Command Path",
            type: "text",
            defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Success'],
            tooltip: "Full path to a .bat/.sh to run on success.",
            onChange: syncConfigToBackend
        });

        app.ui.settings.addSetting({
            id: ID_ERROR,
            name: "Error Command Path",
            type: "text",
            defaultValue: "",
            category: ['HALXP-Comfy', 'Run Monitor', 'Error'],
            tooltip: "Full path to a .bat/.sh to run on error.",
            onChange: syncConfigToBackend
        });

        // --- 3. UI BUTTON CREATION (Copied from Focus) ---

        function createButton() {
            const btn = document.createElement("button");
            btn.textContent = "Monitor";
            btn.id = "halxp-monitor-btn"; 
            
            // EXACT STYLE COPY FROM FOCUS.JS
            btn.style.cssText = `
                position: relative; display: inline-flex; align-items: center; justify-content: center;
                padding: 0 10px; margin: 0 4px; background-color: var(--comfy-input-bg, #333);
                color: var(--fg-color, #fff); border: 1px solid var(--border-color, #555);
                border-radius: 4px; cursor: pointer; font-family: sans-serif; font-size: 13px;
                font-weight: 600; flex-shrink: 0; white-space: nowrap; z-index: 9999; pointer-events: auto;
                border: 1px solid #d3c1c1ff; 
            `;

            // Create the Status Dot
            const d = document.createElement("span");
            d.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background-color: #666; margin-right: 8px; display: inline-block; flex-shrink: 0;`;
            
            btn.prepend(d);
            monitorDot = d;

            // Handle Click: Toggle the setting (which triggers onChange -> syncConfigToBackend)
            btn.onclick = (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                const current = app.ui.settings.getSettingValue(ID_ENABLE, false);
                app.ui.settings.setSettingValue(ID_ENABLE, !current);
            };

            return btn;
        }

        function injectButton() {
            // Prevent duplicates
            if (document.getElementById("halxp-monitor-btn")) return;

            // Find the "Manager" button or any existing button to latch onto
            const allButtons = Array.from(document.querySelectorAll("button"));
            const targetBtn = allButtons.find(b => {
                if (!b.offsetParent) return false;
                const text = b.innerText.trim();
                // Try to place it near Manager, or Focus if it loaded first
                return text === "Manager" || text === "ComfyUI Manager" || text === "Focus";
            });

            if (targetBtn && targetBtn.parentNode) {
                monitorBtn = createButton();
                
                // Match height of the neighbor
                const h = targetBtn.offsetHeight;
                monitorBtn.style.height = h > 0 ? `${h}px` : "28px";

                // Insert BEFORE the target (Standardizes menu flow)
                // If you want it specifically AFTER Focus but BEFORE Manager, this generally works 
                // because extensions load in order.
                targetBtn.parentNode.insertBefore(monitorBtn, targetBtn);
                
                // Set initial visual state
                const isEnabled = app.ui.settings.getSettingValue(ID_ENABLE, false);
                updateButtonVisuals(isEnabled);
            }
        }

        // --- 4. INITIALIZATION ---
        
        // Attempt to inject button periodically until UI is ready
        setInterval(injectButton, 500);

        // Sync backend on load (wait slightly for settings to load)
        setTimeout(syncConfigToBackend, 1000);
    }
});