import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/**
 * ComfyUI Pretty JSON Export Extension
 * Makes workflow JSON exports human-readable with proper indentation
 * for easier version control diffs.
 */

const INDENT_SPACES = 2;
const SETTING_ENABLE_ID = "HALXP.PrettyJSON.Enable";

// Store original methods
let originalMethods = {};

// Track if Pretty JSON formatting is enabled
let isPrettyJsonEnabled = false;

function prettyStringify(obj, indent = INDENT_SPACES) {
    return JSON.stringify(obj, null, indent);
}

// Override the native JSON.stringify for Blob creation in download contexts
function patchBlobConstructor() {
    const OriginalBlob = window.Blob;

    window.Blob = function(parts, options) {
        // Only apply formatting if Pretty JSON is enabled
        if (isPrettyJsonEnabled && (options?.type === "application/json" || options?.type === "text/json")) {
            // Try to parse and re-stringify with formatting
            const newParts = parts.map(part => {
                if (typeof part === "string") {
                    try {
                        const parsed = JSON.parse(part);
                        return prettyStringify(parsed);
                    } catch (e) {
                        return part;
                    }
                }
                return part;
            });
            return new OriginalBlob(newParts, options);
        }
        return new OriginalBlob(parts, options);
    };

    // Preserve prototype chain
    window.Blob.prototype = OriginalBlob.prototype;
}

// Hook into the app's workflow serialization
function patchWorkflowSerialization() {
    // Patch the graph serialization if available
    if (app.graph && app.graph.serialize) {
        const originalSerialize = app.graph.serialize.bind(app.graph);
        app.graph.serialize = function() {
            const result = originalSerialize();
            // Mark that this should be pretty-printed
            result._prettyPrint = true;
            return result;
        };
    }
}

// Intercept file downloads
function patchDownloadFunctions() {
    // Common download pattern used in ComfyUI
    const originalCreateElement = document.createElement.bind(document);
    
    document.createElement = function(tagName, options) {
        const element = originalCreateElement(tagName, options);
        
        if (tagName.toLowerCase() === 'a') {
            const originalSetAttribute = element.setAttribute.bind(element);
            element.setAttribute = function(name, value) {
                if (name === 'href' && value?.startsWith('blob:')) {
                    // This is likely a download - already handled by Blob patch
                }
                return originalSetAttribute(name, value);
            };
        }
        
        return element;
    };
}

// Patch the userdata API calls for workflow saving
function patchApiCalls() {
    const originalFetch = window.fetch;

    window.fetch = async function(url, options) {
        // Only apply formatting if Pretty JSON is enabled
        if (isPrettyJsonEnabled &&
            typeof url === 'string' &&
            url.includes('/userdata/') &&
            url.includes('.json') &&
            options?.method === 'POST' &&
            options?.body) {

            try {
                let body = options.body;

                // Handle string body
                if (typeof body === 'string') {
                    const parsed = JSON.parse(body);
                    options = {
                        ...options,
                        body: prettyStringify(parsed)
                    };
                }
                // Handle Blob body
                else if (body instanceof Blob) {
                    const text = await body.text();
                    try {
                        const parsed = JSON.parse(text);
                        options = {
                            ...options,
                            body: new Blob([prettyStringify(parsed)], { type: body.type })
                        };
                    } catch (e) {
                        // Not JSON, pass through
                    }
                }
            } catch (e) {
                // Parse error, pass through original
                console.debug('[PrettyJSON] Could not format request body:', e);
            }
        }

        return originalFetch(url, options);
    };
}

// Add a menu option to export pretty JSON manually
function addExportMenuItem() {
    const originalGetCanvasMenuOptions = app.canvas?.getCanvasMenuOptions;
    
    if (app.canvas && originalGetCanvasMenuOptions) {
        app.canvas.getCanvasMenuOptions = function() {
            const options = originalGetCanvasMenuOptions.apply(this, arguments);
            
            // Find the export section or add at the end
            options.push(null); // separator
            options.push({
                content: "Export Pretty JSON",
                callback: () => {
                    exportPrettyWorkflow();
                }
            });
            
            return options;
        };
    }
}

// Export workflow as pretty-printed JSON
async function exportPrettyWorkflow() {
    try {
        const workflow = app.graph.serialize();
        const json = prettyStringify(workflow);
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow_pretty.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[PrettyJSON] Exported pretty workflow JSON');
    } catch (e) {
        console.error('[PrettyJSON] Export failed:', e);
        alert('Failed to export workflow: ' + e.message);
    }
}

// Export API format as pretty JSON
async function exportPrettyApiWorkflow() {
    try {
        const prompt = await app.graphToPrompt();
        const json = prettyStringify(prompt.output);
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow_api_pretty.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[PrettyJSON] Exported pretty API workflow JSON');
    } catch (e) {
        console.error('[PrettyJSON] API export failed:', e);
        alert('Failed to export API workflow: ' + e.message);
    }
}

// Register the extension
app.registerExtension({
    name: "comfy.prettyJson",

    async setup() {
        console.log('[PrettyJSON] Initializing Pretty JSON Export extension...');

        // Register the setting
        app.ui.settings.addSetting({
            id: SETTING_ENABLE_ID,
            name: "Enable Pretty JSON",
            type: "boolean",
            defaultValue: false,
            category: ['HALXP-Comfy', 'Pretty JSON', 'Enable'],
            tooltip: "Enable Pretty JSON formatting to ease diffs and make it readable.",
            onChange: (value) => {
                isPrettyJsonEnabled = value;
                console.log(`[PrettyJSON] Pretty JSON formatting ${value ? 'enabled' : 'disabled'}`);
            }
        });

        // Apply patches (they check isPrettyJsonEnabled internally)
        patchBlobConstructor();
        patchApiCalls();

        // Initialize state from saved setting
        setTimeout(() => {
            isPrettyJsonEnabled = app.ui.settings.getSettingValue(SETTING_ENABLE_ID, false);
            console.log(`[PrettyJSON] Extension loaded - formatting is ${isPrettyJsonEnabled ? 'enabled' : 'disabled'}`);
        }, 100);
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // Can add node-specific hooks here if needed
    }
});

// Also expose functions globally for manual use in console
window.exportPrettyWorkflow = exportPrettyWorkflow;
window.exportPrettyApiWorkflow = exportPrettyApiWorkflow;

console.log('[PrettyJSON] Pretty JSON Export extension registered');
console.log('[PrettyJSON] Enable in Settings > HALXP-Comfy > Pretty JSON');
console.log('[PrettyJSON] Manual export available via: exportPrettyWorkflow() or exportPrettyApiWorkflow()');
