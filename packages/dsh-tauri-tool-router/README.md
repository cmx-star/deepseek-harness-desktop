# DSH Tauri Tool Router

Routes model-facing tool schemas per Agent request without unregistering tools or changing permissions.

The plugin classifies the latest user message before prompt assembly, keeps a small `request_tools` expansion tool available, and filters only the current request's tool schemas. Ambiguous messages retain the full schema set.
