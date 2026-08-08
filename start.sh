#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

admin_ui_host="${ADMIN_UI_HOST:-0.0.0.0}"
admin_ui_port="${ADMIN_UI_PORT:-5178}"
people_login_origin="${PEOPLE_LOGIN_ORIGIN:-http://10.251.237.216:5177}"

export VITE_PERMISSION_API_BASE_URL="${VITE_PERMISSION_API_BASE_URL:-/api/permission/v1}"
export VITE_GATEWAY_ADMIN_API_BASE_URL="${VITE_GATEWAY_ADMIN_API_BASE_URL:-/api/gateway-admin/v1}"
export VITE_PERMISSION_PROXY_TARGET="${PERMISSION_API_ORIGIN:-http://127.0.0.1:8081}"
export VITE_GATEWAY_ADMIN_PROXY_TARGET="${GATEWAY_ADMIN_API_ORIGIN:-http://127.0.0.1:8083}"
export VITE_BLOG_API_BASE_URL="${VITE_BLOG_API_BASE_URL:-/api/blog/v1}"
export VITE_BLOG_PROXY_TARGET="${BLOG_API_ORIGIN:-http://127.0.0.1:8086}"
export VITE_PEOPLE_LOGIN_ORIGIN="$people_login_origin"
export VITE_PEOPLE_UI_URL="${PEOPLE_UI_URL:-${people_login_origin%/}/profile}"
export VITE_OAUTH_REDIRECT_URI="${ADMIN_UI_OAUTH_REDIRECT_URI:-http://10.251.237.216:${admin_ui_port}/oauth/callback}"

exec npm run dev -- --host "$admin_ui_host" --port "$admin_ui_port" --strictPort
