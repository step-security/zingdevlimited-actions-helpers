#!/bin/bash
set -euo pipefail

CONFIG_SECTION="$1"
CONFIG_DATA_JSON="$2"

: "${TWILIO_ACCOUNT_SID:?Missing TWILIO_ACCOUNT_SID}"
: "${TWILIO_API_KEY:?Missing TWILIO_API_KEY}"
: "${TWILIO_API_SECRET:?Missing TWILIO_API_SECRET}"

# The section name ends up as an object key. Restricting it to identifier
# characters keeps it from being read as anything but a key.
if [[ ! "$CONFIG_SECTION" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "::error::CONFIG_SECTION must contain only letters, digits, underscores and hyphens" >&2
  exit 1
fi

echo "$CONFIG_DATA_JSON" | jq . > /dev/null || { echo "::error::CONFIG_DATA_JSON is not valid JSON" >&2; exit 1; }

FLEX_CONFIG_URL="https://flex-api.twilio.com/v1/Configuration"

# Credentials go in a private config file rather than argv, where they would be
# readable from the process list for the lifetime of the request.
CURL_CONFIG=$(mktemp)
chmod 600 "$CURL_CONFIG"
trap 'rm -f "$CURL_CONFIG"' EXIT
printf 'user = "%s:%s"\n' "$TWILIO_API_KEY" "$TWILIO_API_SECRET" > "$CURL_CONFIG"

CURRENT_CONFIG=$(curl -sSf --config "$CURL_CONFIG" "$FLEX_CONFIG_URL") || {
  echo "::error::Failed to fetch Flex Configuration" >&2; exit 1;
}

UI_ATTRS=$(echo "$CURRENT_CONFIG" | jq -r '.ui_attributes // empty')
if [ -z "$UI_ATTRS" ]; then
  echo "::error::Failed to retrieve ui_attributes from Flex Configuration" >&2; exit 1;
fi

# Values are handed to jq as typed arguments, so neither the section name nor the
# payload is ever parsed as part of a filter or a JSON document.
MERGED=$(echo "$UI_ATTRS" | jq \
  --arg section "$CONFIG_SECTION" \
  --argjson data "$CONFIG_DATA_JSON" \
  '.[$section] = $data')

PAYLOAD=$(jq -n \
  --arg sid "$TWILIO_ACCOUNT_SID" \
  --argjson attrs "$MERGED" \
  '{account_sid: $sid, ui_attributes: $attrs}')

UPDATE_RESP=$(curl -sSf -X POST "$FLEX_CONFIG_URL" \
  --config "$CURL_CONFIG" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD") || {
  echo "::error::Failed to update Flex Configuration" >&2; exit 1;
}

if [ -z "$(echo "$UPDATE_RESP" | jq -r '.ui_attributes // empty')" ]; then
  echo "::error::Update response missing ui_attributes: $UPDATE_RESP" >&2; exit 1;
fi

echo "Updated .ui_attributes.$CONFIG_SECTION" >&2
echo "$MERGED" | jq --arg section "$CONFIG_SECTION" '.[$section]' >&2

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Updated Flex Configuration"
    echo '```json'
    jq -n --arg section "$CONFIG_SECTION" --argjson data "$CONFIG_DATA_JSON" '{($section): $data}'
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
fi
