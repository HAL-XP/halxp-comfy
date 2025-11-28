// \ComfyUI\custom_nodes\better-focus\js\universal_focus.js
// console.log("%c[HALXP-Comfy-Focus] Loaded", "background: purple; color: white; font-weight: bold;");

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.HALXP-ComfyUI.Focus",
    async setup() {
        // --- CONFIG ---
        const SMOOTHNESS = 0.15;
        const SETTING_ID = "HALXP-Comfy.Focus.DisplayButton";
        
        let isFocusEnabled = false;
        let activeNode = null;
        let animationFrameId = null;
        let focusBtn = null;
        let dot = null;

        // --- 0. REGISTER SETTING ---
        app.ui.settings.addSetting({
            id: SETTING_ID,
            name: "Display Focus Button",
            type: "boolean",
            defaultValue: true,
            // MUST be an array. 
            // Element 0 = Tab Name (HALXP-Comfy)
            // Element 1 = Section Header (Focus)
            category: ['HALXP-Comfy', 'Focus'], 
            tooltip: "Show or hide the HALXP Focus button in the top menu.",
            onChange: (value) => {
                if (value) {
                    // Try to inject immediately if turned on
                    injectNextToManager();
                } else {
                    // Remove button and disable focus if turned off
                    if (focusBtn) {
                        focusBtn.remove();
                        // Also force stop focus mode if it was active
                        if (isFocusEnabled) setFocusState(false);
                    }
                }
            }
        });

        // --- 1. CREATE BUTTON ---
        function createButton() {
            const btn = document.createElement("button");
            btn.textContent = "Focus";
            btn.id = "halxp-focus-btn"; 
            
            // CSS: Flex-safe, visible, matches Manager style
            btn.style.cssText = `
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 10px;
                margin: 0 4px; /* Space between Focus and Manager */
                
                background-color: var(--comfy-input-bg, #333);
                color: var(--fg-color, #fff);
                border: 1px solid var(--border-color, #555);
                border-radius: 4px;
                
                cursor: pointer;
                font-family: sans-serif;
                font-size: 13px;
                font-weight: 600;
                
                /* CRITICAL VISIBILITY SETTINGS */
                flex-shrink: 0; 
                white-space: nowrap;
                z-index: 9999;
                pointer-events: auto;
                
                /* DEBUG: REMOVE THIS RED BORDER LATER IF YOU WANT */
                border: 1px solid #d3c1c1ff; 
            `;

            const d = document.createElement("span");
            d.style.cssText = `
                width: 8px; height: 8px; border-radius: 50%; 
                background-color: #666; margin-right: 8px;
                display: inline-block;
                flex-shrink: 0;
            `;
            btn.prepend(d);
            
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFocus();
            };

            dot = d;
            return btn;
        }

        // --- 2. FIND MANAGER & INJECT ---
        function injectNextToManager() {
            // Check Settings first. If setting is false, do not inject.
            const shouldDisplay = app.ui.settings.getSettingValue(SETTING_ID, true);
            if (!shouldDisplay) return;

            // Stop if we already exist
            if (document.getElementById("halxp-focus-btn")) return;

            // 1. Find the Manager Button
            // We look for any button that strictly contains the text "Manager"
            const allButtons = Array.from(document.querySelectorAll("button"));
            
            const managerBtn = allButtons.find(b => {
                // Must be visible
                if (!b.offsetParent) return false;
                
                const text = b.innerText.trim();
                return text === "Manager" || text === "ComfyUI Manager";
            });

            // 2. Inject
            if (managerBtn && managerBtn.parentNode) {
                // console.log("[Visual Assist] Found Manager Button. Attaching...");
                
                if (!focusBtn) focusBtn = createButton();
                
                // Match the height of the Manager button exactly
                const h = managerBtn.offsetHeight;
                if (h > 0) focusBtn.style.height = `${h}px`;
                else focusBtn.style.height = "28px";

                // Insert BEFORE the Manager button (to its left)
                managerBtn.parentNode.insertBefore(focusBtn, managerBtn);
                
                // Restore state appearance if we were somehow already enabled
                if (isFocusEnabled) {
                    dot.style.backgroundColor = "#4CAF50";
                    dot.style.boxShadow = "0 0 6px #4CAF50";
                    focusBtn.style.color = "#fff";
                    focusBtn.style.borderColor = "#4CAF50"; 
                }
                
                return;
            }
        }

        // --- 3. LOOP ---
        // We poll every 500ms because the Manager itself loads slowly.
        setInterval(injectNextToManager, 500);


        // --- 4. FOCUS LOGIC (Standard) ---
        function toggleFocus() {
            setFocusState(!isFocusEnabled);
        }

        function setFocusState(enabled) {
            isFocusEnabled = enabled;
            // Guard: If button doesn't exist (setting off), we can't style it.
            if (!focusBtn || !dot) return; 

            if (isFocusEnabled) {
                dot.style.backgroundColor = "#4CAF50";
                dot.style.boxShadow = "0 0 6px #4CAF50";
                focusBtn.style.color = "#fff";
                focusBtn.style.borderColor = "#4CAF50"; 
                if (activeNode) requestAnimationFrame(smoothFollow);
            } else {
                dot.style.backgroundColor = "#666";
                dot.style.boxShadow = "none";
                focusBtn.style.color = "var(--fg-color, #ccc)";
                focusBtn.style.borderColor = "#d3c1c1ff"; // Back to disabled
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        }

        // Listen for canvas drag
        const waitForCanvas = setInterval(() => {
            if (app.canvas && app.canvas.canvas) {
                clearInterval(waitForCanvas);
                app.canvas.canvas.addEventListener("pointerdown", () => {
                    if (isFocusEnabled) setFocusState(false);
                }, { capture: true });
            }
        }, 500);

        api.addEventListener("executing", (e) => {
            if (e.detail) {
                activeNode = app.graph.getNodeById(e.detail);
                if (isFocusEnabled && activeNode) {
                     app.canvas.setDirty(true, true);
                     if (!animationFrameId) requestAnimationFrame(smoothFollow);
                }
            }
        });

        function smoothFollow() {
            if (isFocusEnabled && activeNode) {
                const canvas = app.canvas;
                const ds = canvas.ds;
                const screenCenterX = canvas.canvas.clientWidth / 2;
                const screenCenterY = canvas.canvas.clientHeight / 2;
                const nodeCenterX = activeNode.pos[0] + activeNode.size[0] / 2;
                const nodeCenterY = activeNode.pos[1] + activeNode.size[1] / 2;
                const targetOffsetX = (screenCenterX / ds.scale) - nodeCenterX;
                const targetOffsetY = (screenCenterY / ds.scale) - nodeCenterY;
                ds.offset[0] += (targetOffsetX - ds.offset[0]) * SMOOTHNESS;
                ds.offset[1] += (targetOffsetY - ds.offset[1]) * SMOOTHNESS;
                canvas.setDirty(true, true);
                animationFrameId = requestAnimationFrame(smoothFollow);
            }
        }
    }
});