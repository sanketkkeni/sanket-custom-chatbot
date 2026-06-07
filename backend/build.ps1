# Build Lambda zip files for deployment
# Run from the backend directory: ./build.ps1

Write-Host "Building Lambda zip files..."

# Create utils.zip
Compress-Archive -Path utils.py -DestinationPath utils.zip -Force
Write-Host "Created utils.zip"

# Create kb_api.zip
Compress-Archive -Path kb_api.py,utils.py -DestinationPath kb_api.zip -Force
Write-Host "Created kb_api.zip"

# Create chat_handler.zip
Compress-Archive -Path chat_handler.py,utils.py -DestinationPath chat_handler.zip -Force
Write-Host "Created chat_handler.zip"

# Create history_handler.zip
Compress-Archive -Path history_handler.py,utils.py -DestinationPath history_handler.zip -Force
Write-Host "Created history_handler.zip"

Write-Host "Build complete!"
