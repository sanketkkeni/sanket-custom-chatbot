# Build Lambda zip files for deployment
# Run from the backend directory: ./build.ps1

Write-Host "Building Lambda zip files..."

$OUTPUT_DIR = Join-Path $PSScriptRoot "..\infrastructure"

# Create utils.zip
Compress-Archive -Path (Join-Path $PSScriptRoot "utils.py") -DestinationPath (Join-Path $OUTPUT_DIR "utils.zip") -Force
Write-Host "Created utils.zip"

# Create kb_api.zip
Compress-Archive -Path (Join-Path $PSScriptRoot "kb_api.py"),(Join-Path $PSScriptRoot "utils.py") -DestinationPath (Join-Path $OUTPUT_DIR "kb_api.zip") -Force
Write-Host "Created kb_api.zip"

# Create chat_handler.zip
Compress-Archive -Path (Join-Path $PSScriptRoot "chat_handler.py"),(Join-Path $PSScriptRoot "utils.py") -DestinationPath (Join-Path $OUTPUT_DIR "chat_handler.zip") -Force
Write-Host "Created chat_handler.zip"

# Create history_handler.zip
Compress-Archive -Path (Join-Path $PSScriptRoot "history_handler.py"),(Join-Path $PSScriptRoot "utils.py") -DestinationPath (Join-Path $OUTPUT_DIR "history_handler.zip") -Force
Write-Host "Created history_handler.zip"

# Build Pillow Lambda layer (manylinux wheel for Python 3.13)
$LAYER_DIR = Join-Path $PSScriptRoot "layer"
if (Test-Path (Join-Path $LAYER_DIR "python")) {
    Remove-Item -Recurse -Force (Join-Path $LAYER_DIR "python")
}
New-Item -ItemType Directory -Path (Join-Path $LAYER_DIR "python") -Force | Out-Null
pip install Pillow --platform manylinux2014_x86_64 --python-version 313 --target (Join-Path $LAYER_DIR "python") --only-binary=:all: --no-deps 2>&1 | Out-Null
Compress-Archive -Path (Join-Path $LAYER_DIR "python") -DestinationPath (Join-Path $OUTPUT_DIR "pillow-layer.zip") -Force
Write-Host "Created pillow-layer.zip"

# Create image_processor.zip
Compress-Archive -Path (Join-Path $PSScriptRoot "image_processor.py") -DestinationPath (Join-Path $OUTPUT_DIR "image_processor.zip") -Force
Write-Host "Created image_processor.zip"

# Create openai_proxy.zip for the Open Web UI proxy
$OPENWEBUI_OUTPUT_DIR = Join-Path $OUTPUT_DIR "modules\openwebui"
if (-not (Test-Path $OPENWEBUI_OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OPENWEBUI_OUTPUT_DIR -Force | Out-Null
}
Compress-Archive -Path (Join-Path $PSScriptRoot "openwebui\openai_proxy.py"),(Join-Path $PSScriptRoot "utils.py") -DestinationPath (Join-Path $OPENWEBUI_OUTPUT_DIR "openai_proxy.zip") -Force
Write-Host "Created openai_proxy.zip"

Write-Host "Build complete!"
