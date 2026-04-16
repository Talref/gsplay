#!/usr/bin/env bash

# --- Configuration ---
# The target directory for deployment
DESTINATION="/srv/gsplay/"

# --- Rsync Execution ---
# -a: Archive mode (recursive, copies symlinks, preserves permissions, ownership, etc.)
# -v: Verbose output (shows what files are being transferred)
# -z: Compress file data during the transfer
# --delete: CRITICAL! Deletes files in DESTINATION that are NOT in the source directory ('.').
# --exclude '.git': Excludes the hidden Git repository folder from the sync.
# --progress: Shows progress during the transfer.
# NOTE: 'sudo' is used here because /srv/gsplay/ typically requires root write access.

echo "Starting synchronization from current directory (./) to $DESTINATION"
echo "NOTE: Files in $DESTINATION not present locally will be deleted."

sudo rsync -avz --delete --exclude '.git' --progress . "$DESTINATION"

# --- Status Check ---
if [ $? -eq 0 ]; then
    echo "✅ Synchronization complete! Your repo contents are now live in $DESTINATION."
else
    echo "❌ Rsync failed. Please check permissions or the path."
fi
