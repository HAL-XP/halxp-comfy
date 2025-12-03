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
run_has_error = False

# --- 1. API ROUTE ---
@server.PromptServer.instance.routes.post("/halxp/update_config")
async def update_halxp_config(request):
    try:
        data = await request.json()
        halxp_config.update(data)
        return web.json_response({"status": "ok"})
    except Exception as e:
        print(f"[HALXP-Core] Error updating config: {e}")
        return web.json_response({"status": "error"}, status=500)

# --- 2. MESSAGE HOOK ---
original_send_json = server.PromptServer.instance.send_json

async def intercepted_send_json(self, event, data, sid=None):
    global run_has_error
    
    # 1. Execute Original Behavior
    await original_send_json(event, data, sid)
    
    # 2. Check RunMonitor Logic
    if halxp_config.get("enabled"):
        try:
            # --- START: SAFETY RESET ---
            # Just in case the last run didn't clear the flag, we clear it on start too.
            if event == "execution_start":
                run_has_error = False

            # --- DETECT ERROR ---
            elif event == "execution_error":
                run_has_error = True
                cmd = halxp_config.get("error_path")
                if cmd and cmd.strip():
                    print(f"[HALXP-RunMonitor] ❌ Workflow Error. Running: {cmd}")
                    subprocess.Popen(cmd, shell=True)

            # --- DETECT FINISH (SUCCESS or FAIL) ---
            # 'executing' with node=None means the prompt is done.
            elif event == "executing" and data.get("node") is None:
                
                # Only run success script if NO error occurred
                if not run_has_error:
                    cmd = halxp_config.get("success_path")
                    if cmd and cmd.strip():
                        print(f"[HALXP-RunMonitor] ✅ Workflow Finished. Running: {cmd}")
                        subprocess.Popen(cmd, shell=True)
                
                # --- CRITICAL FIX: ALWAYS RESET STATE HERE ---
                # Once the run is finished, we must clear the error flag 
                # so the NEXT run starts fresh.
                if run_has_error:
                    print(f"[HALXP-RunMonitor] 🔄 Run finished with errors. Resetting state for next run.")
                    run_has_error = False

        except Exception as e:
            print(f"[HALXP-RunMonitor] ⚠️ Failed to execute monitoring script: {e}")

# Apply the hook
server.PromptServer.instance.send_json = intercepted_send_json.__get__(server.PromptServer.instance, server.PromptServer)

# --- STANDARD NODE MAPPING ---
WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]