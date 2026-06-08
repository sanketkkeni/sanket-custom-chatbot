# Build Lambda zip files for deployment
# Run from the backend directory: ./build.ps1

Write-Host "Building Lambda zip files..."

$OUTPUT_DIR = Join-Path $PSScriptRoot "..\infrastructure"

# Create utils.zip
Compress-Archive -Path utils.py -DestinationPath (Join-Path $OUTPUT_DIR "utils.zip") -Force
Write-Host "Created utils.zip"

# Create kb_api.zip
Compress-Archive -Path kb_api.py,utils.py -DestinationPath (Join-Path $OUTPUT_DIR "kb_api.zip") -Force
Write-Host "Created kb_api.zip"

# Create chat_handler.zip
Compress-Archive -Path chat_handler.py,utils.py -DestinationPath (Join-Path $OUTPUT_DIR "chat_handler.zip") -Force
Write-Host "Created chat_handler.zip"

# Create history_handler.zip
Compress-Archive -Path history_handler.py,utils.py -DestinationPath (Join-Path $OUTPUT_DIR "history_handler.zip") -Force
Write-Host "Created history_handler.zip"

Write-Host "Build complete!"
