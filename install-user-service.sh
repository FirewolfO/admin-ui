#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$unit_dir"
install -m 0644 "$project_dir/deploy/systemd/admin-ui.service" "$unit_dir/admin-ui.service"
systemctl --user daemon-reload
systemctl --user enable admin-ui.service
systemctl --user restart admin-ui.service
systemctl --user --no-pager --full status admin-ui.service
