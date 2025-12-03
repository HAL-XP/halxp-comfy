import server
import subprocess
import asyncio
from aiohttp import web

# --- CONFIG STORAGE ---
halxp_config = {
    "enabled": False,
    "success_path": "",
    "error_path": ""
}

# --- STATE TRACKING ---
# We store the ID of the prompt that just failed.
last_failed_prompt_id = None

# --- 1. API ROUTE ---
@server.PromptServer.instance.routes.post("/halxp/update_config")
async def update_halxp_config(request):
    try:
        data = await request.json()
        halxp_config.update(data)
        # Debug Log to confirm settings are received
        print(f"[HALXP-Core] Settings Updated: Enabled={halxp_config['enabled']}")
        return web.json_response({"status": "ok"})
    except Exception as e:
        print(f"[HALXP-Core] Error updating config: {e}")
        return web.json_response({"status": "error"}, status=500)

# --- 2. MESSAGE HOOK ---
original_send_json = server.PromptServer.instance.send_json

async def intercepted_send_json(self, event, data, sid=None):
    global last_failed_prompt_id
    
    # 1. Execute Original Behavior
    await original_send_json(event, data, sid)
    
    # 2. Check RunMonitor Logic
    if halxp_config.get("enabled"):
        try:
            # --- DETECT ERROR ---
            if event == "execution_error":
                # Record which prompt ID failed
                current_id = data.get("prompt_id")
                last_failed_prompt_id = current_id
                
                print(f"[HALXP-Monitor] ❌ Error detected for Prompt ID: {current_id}")
                
                cmd = halxp_config.get("error_path")
                if cmd and cmd.strip():
                    print(f"[HALXP-Monitor] 🚀 Running Error Script...")
                    subprocess.Popen(cmd, shell=True)

            # --- DETECT FINISH ---
            # 'executing' with node=None means the prompt is fully done
            elif event == "executing" and data.get("node") is None:
                finished_id = data.get("prompt_id")
                
                # LOGIC: Only run success if this ID is NOT the one that just failed
                if finished_id != last_failed_prompt_id:
                    cmd = halxp_config.get("success_path")
                    if cmd and cmd.strip():
                        print(f"[HALXP-Monitor] ✅ Workflow Finished (Success). Running Script...")
                        subprocess.Popen(cmd, shell=True)
                    else:
                        print(f"[HALXP-Monitor] ✅ Workflow Finished, but no Success Path configured.")
                else:
                    print(f"[HALXP-Monitor] ℹ️ Workflow Finished, but skipping Success Script (This was the failed run).")

        except Exception as e:
            print(f"[HALXP-Monitor] ⚠️ Script Execution Failed: {e}")

# Apply the hook
server.PromptServer.instance.send_json = intercepted_send_json.__get__(server.PromptServer.instance, server.PromptServer)

# --- STANDARD NODE MAPPING ---
WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]