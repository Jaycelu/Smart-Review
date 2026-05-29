#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="smart-review"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<EOF
Usage:
  ./scripts/install-smart-review-plugin.sh "/path/to/your/vault"

Example for iCloud Obsidian vaults:
  ./scripts/install-smart-review-plugin.sh "\$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/YourVaultName"
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

VAULT_PATH="$1"

if [[ ! -d "$VAULT_PATH" ]]; then
  echo "Error: Vault path does not exist: $VAULT_PATH" >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "Error: corepack is required but was not found." >&2
  exit 1
fi

PLUGIN_SOURCE_DIR="$REPO_ROOT/apps/smart-review-plugin"
PLUGIN_TARGET_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

echo "Repository: $REPO_ROOT"
echo "Vault:      $VAULT_PATH"
echo "Plugin:     $PLUGIN_TARGET_DIR"
echo

cd "$REPO_ROOT"

echo "Building plugin..."
corepack pnpm build

for file in main.js manifest.json styles.css; do
  if [[ ! -f "$PLUGIN_SOURCE_DIR/$file" ]]; then
    echo "Error: Missing build artifact: $PLUGIN_SOURCE_DIR/$file" >&2
    exit 1
  fi
done

echo
echo "Creating plugin directory..."
mkdir -p "$PLUGIN_TARGET_DIR"

echo "Copying plugin files..."
cp "$PLUGIN_SOURCE_DIR/main.js" "$PLUGIN_TARGET_DIR/main.js"
cp "$PLUGIN_SOURCE_DIR/manifest.json" "$PLUGIN_TARGET_DIR/manifest.json"
cp "$PLUGIN_SOURCE_DIR/styles.css" "$PLUGIN_TARGET_DIR/styles.css"

echo
echo "Installed Smart Review plugin successfully."
echo
echo "Next steps:"
echo "  1. Open Obsidian."
echo "  2. Enable the community plugin: Smart Review."
echo "  3. Click the Ribbon icon to open Review Center."
echo "  4. Run Command Palette: Generate Review Index if you want to overwrite review-index.json manually."
echo "  5. Check that this file exists: $VAULT_PATH/review-index.json"
