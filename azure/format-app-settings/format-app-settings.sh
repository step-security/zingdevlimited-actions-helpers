#!/usr/bin/env bash
set -euo pipefail

APP_SETTINGS_ENV="$1"
STICKY_SETTINGS="$2"
ENCRYPT_OUTPUT="$3"
ENCRYPTION_PASSWORD="$4"
ENCRYPTION_FLAGS="$5"

# Build a lookup of sticky setting names
declare -A sticky_map
if [[ -n "$STICKY_SETTINGS" ]]; then
  IFS=',' read -ra sticky_list <<< "$STICKY_SETTINGS"
  for s in "${sticky_list[@]}"; do
    key="${s// /}"
    sticky_map["$key"]=1
  done
fi

# Parse key=value pairs and build Azure App Settings JSON array
json="["
first=true
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"

  sticky="false"
  if [[ -n "${sticky_map[$key]+_}" ]]; then
    sticky="true"
  fi

  # JSON-encode both halves; a key containing a quote would otherwise break out
  # of the string it is placed in and corrupt the document.
  encoded_key=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$key")
  encoded_value=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$value")

  if [[ "$first" == "true" ]]; then
    first=false
  else
    json+=","
  fi
  json+="{\"name\":$encoded_key,\"value\":$encoded_value,\"slotSetting\":$sticky}"
done <<< "$APP_SETTINGS_ENV"

json+="]"

if [[ "$ENCRYPT_OUTPUT" == "true" ]]; then
  # Hand the password to openssl through the environment; on the command line it
  # would be readable from the process list.
  export ENCRYPTION_PASSWORD
  # shellcheck disable=SC2086
  encrypted=$(printf '%s' "$json" | openssl enc $ENCRYPTION_FLAGS -pass env:ENCRYPTION_PASSWORD | base64 -w 0)
  printf 'APP_SETTINGS=%s\n' "$encrypted" >> "$GITHUB_OUTPUT"
else
  EOF=$(dd if=/dev/urandom bs=15 count=1 status=none | base64)
  printf 'APP_SETTINGS<<%s\n%s\n%s\n' "$EOF" "$json" "$EOF" >> "$GITHUB_OUTPUT"
fi
