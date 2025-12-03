import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.HALXP.Focus",
    async setup() {
        // --- CONSTANTS ---
        const SMOOTHNESS = 0.15;
        // Clean IDs
        const SETTING_DISPLAY_ID = "HALXP.Focus.DisplayButton";
        const SETTING_AUTO_ID = "HALXP.Focus.AutoEnable";

        // --- STATE ---
        let isFocusEnabled = false;
        let isWorkflowRunning = false;
        let activeNode = null;
        let animationFrameId = null;
        let focusBtn = null;
        let dot = null;

        // --- 1. REGISTER SETTINGS ---
        app.ui.settings.addSetting({
            id: SETTING_DISPLAY_ID,
            name: "Display Focus Button",
            type: "boolean",
            defaultValue: true,
            // 3rd element 'Display' ensures uniqueness
            category: ['HALXP-Comfy', 'Focus', 'Display'], 
            tooltip: "Show or hide the HALXP Focus button in the top menu.",
            onChange: (value) => {
                if (value) injectNextToManager();
                else {
                    if (focusBtn) focusBtn.remove();
                    if (isFocusEnabled) setFocusState(false);
                }
            }
        });

        app.ui.settings.addSetting({
            id: SETTING_AUTO_ID,
            name: "Auto-Focus on Run",
            type: "boolean",
            defaultValue: true,
            // 3rd element 'Auto' ensures uniqueness
            category: ['HALXP-Comfy', 'Focus', 'Auto'],
            tooltip: "Automatically enable Focus mode when a workflow starts executing.",
        });

        // --- 2. BUTTON LOGIC ---
        function createButton() {
            const btn = document.createElement("button");
            btn.textContent = "Focus";
            btn.id = "halxp-focus-btn"; 
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
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleFocus(); };
            dot = d;
            return btn;
        }

        function injectNextToManager() {
            const shouldDisplay = app.ui.settings.getSettingValue(SETTING_DISPLAY_ID, true);
            if (!shouldDisplay || document.getElementById("halxp-focus-btn")) return;
            
            const allButtons = Array.from(document.querySelectorAll("button"));
            const managerBtn = allButtons.find(b => {
                if (!b.offsetParent) return false;
                const text = b.innerText.trim();
                return text === "Manager" || text === "ComfyUI Manager";
            });

            if (managerBtn && managerBtn.parentNode) {
                if (!focusBtn) focusBtn = createButton();
                const h = managerBtn.offsetHeight;
                focusBtn.style.height = h > 0 ? `${h}px` : "28px";
                managerBtn.parentNode.insertBefore(focusBtn, managerBtn);
                if (isFocusEnabled) updateButtonStyle(true);
            }
        }
        setInterval(injectNextToManager, 500);

        // --- 3. FOCUS CORE LOGIC ---
        function toggleFocus() { setFocusState(!isFocusEnabled); }

        function setFocusState(enabled) {
            isFocusEnabled = enabled;
            if (focusBtn && dot) updateButtonStyle(enabled);
            if (enabled && activeNode) requestAnimationFrame(smoothFollow);
            else if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        }

        function updateButtonStyle(enabled) {
            if (!dot || !focusBtn) return;
            if (enabled) {
                dot.style.backgroundColor = "#4CAF50"; dot.style.boxShadow = "0 0 6px #4CAF50";
                focusBtn.style.color = "#fff"; focusBtn.style.borderColor = "#4CAF50"; 
            } else {
                dot.style.backgroundColor = "#666"; dot.style.boxShadow = "none";
                focusBtn.style.color = "var(--fg-color, #ccc)"; focusBtn.style.borderColor = "#d3c1c1ff";
            }
        }

        // Disable on manual drag
        const waitForCanvas = setInterval(() => {
            if (app.canvas && app.canvas.canvas) {
                clearInterval(waitForCanvas);
                app.canvas.canvas.addEventListener("pointerdown", () => {
                    if (isFocusEnabled) setFocusState(false);
                }, { capture: true });
            }
        }, 500);

        // --- 4. EXECUTION LOOP ---
        api.addEventListener("executing", (e) => {
            if (e.detail) {
                if (!isWorkflowRunning) {
                    isWorkflowRunning = true;
                    if (app.ui.settings.getSettingValue(SETTING_AUTO_ID, true)) setFocusState(true);
                }
                activeNode = app.graph.getNodeById(e.detail);
                if (isFocusEnabled && activeNode) {
                     app.canvas.setDirty(true, true);
                     if (!animationFrameId) requestAnimationFrame(smoothFollow);
                }
            } else {
                isWorkflowRunning = false;
                activeNode = null;
            }
        });

        function smoothFollow() {
            if (isFocusEnabled && activeNode) {
                const canvas = app.canvas;
                const ds = canvas.ds;
                const center = [canvas.canvas.clientWidth / 2, canvas.canvas.clientHeight / 2];
                const nodeCenter = [activeNode.pos[0] + activeNode.size[0] / 2, activeNode.pos[1] + activeNode.size[1] / 2];
                const target = [(center[0] / ds.scale) - nodeCenter[0], (center[1] / ds.scale) - nodeCenter[1]];
                ds.offset[0] += (target[0] - ds.offset[0]) * SMOOTHNESS;
                ds.offset[1] += (target[1] - ds.offset[1]) * SMOOTHNESS;
                canvas.setDirty(true, true);
                animationFrameId = requestAnimationFrame(smoothFollow);
            }
        }
    }
});