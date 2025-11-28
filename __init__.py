# HALXP - High Availability & Layout eXtension Pack
# Registers the web directory for JS extensions

WEB_DIRECTORY = "./js"

# Export empty dictionaries so ComfyUI doesn't warn about missing mappings
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

print("\033[34m[HALXP-ComfyUI] JS Extensions Loaded successfully.\033[0m")