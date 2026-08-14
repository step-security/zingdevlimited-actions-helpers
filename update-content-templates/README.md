[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Content Templates

Creates the Twilio Content Templates listed in a JSON file, so the messaging content your flows and functions reference is guaranteed to exist in the target account.

A template is identified by the pair `friendly_name` + `language`, which means the same template can be defined once per locale. Twilio treats Content Templates as immutable once created, so by default a template that already exists is left alone even if the config file has since diverged. See [Replacing templates](#replacing-templates) to opt into recreation.

## Usage

```yaml
steps:
  - name: Check out the template config
    uses: actions/checkout@v7
    with:
      sparse-checkout: content-templates.json
      sparse-checkout-cone-mode: false

  - name: Apply Content Templates
    uses: step-security/zingdevlimited-actions-helpers/update-content-templates@v5
    with:
      CONFIG_PATH: content-templates.json
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `CONFIG_PATH` | yes | Path to the JSON file described below. Check it out before this step runs. |
| `ALLOW_REPLACE` | no | `true` to delete and recreate templates that differ from the config. Defaults to `false`. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `RESOURCES` | JSON object of every template the run touched, grouped by language then by friendly name, each holding the Twilio resource (including its `sid`). |

## Configuration file

A single `templates` array. Entries are sent to Twilio's Content API as-is, so any content type the API accepts works here.

| Field | Required | Description |
| --- | --- | --- |
| `friendly_name` | yes | Template name. Combined with `language` to detect whether the template already exists. |
| `language` | yes | Locale code, e.g. `en`. |
| `types` | yes | Map of Twilio content type to that type's body. Supply `twilio/text` alongside a richer type as the fallback for channels that cannot render it. |
| `variables` | no | Map of placeholder index to a sample value, used for previews in the Twilio Console. |

Placeholders in a body are written `{{1}}`, `{{2}}` and so on, matching the keys in `variables`.

### Example

```json
{
  "templates": [
    {
      "friendly_name": "appointment_reminder",
      "language": "en",
      "variables": {
        "1": "Wednesday 14 May",
        "2": "10:30"
      },
      "types": {
        "twilio/quick-reply": {
          "body": "Your appointment is booked for {{1}} at {{2}}. Does that still work for you?",
          "actions": [
            { "title": "Yes, keep it", "id": "confirm" },
            { "title": "Reschedule", "id": "reschedule" },
            { "title": "Cancel", "id": "cancel" }
          ]
        },
        "twilio/text": {
          "body": "Your appointment is booked for {{1}} at {{2}}. Reply CONFIRM to keep it, CHANGE to reschedule, or CANCEL to cancel."
        }
      }
    }
  ]
}
```

## Replacing templates

Because Twilio cannot edit a Content Template in place, changing a template's wording normally requires creating a new one. Setting `ALLOW_REPLACE: true` lets the action do that for you: when the `types` or `variables` in the config no longer match what is in the account, the existing template is deleted and a fresh one created from the config.

> [!WARNING]
> A replaced template comes back with a **new SID**. Anything holding the old SID — Studio flows, functions, stored configuration — has to be updated in the same deploy, or it will start referencing a template that no longer exists.

```yaml
  - name: Apply Content Templates
    uses: step-security/zingdevlimited-actions-helpers/update-content-templates@v5
    with:
      CONFIG_PATH: content-templates.json
      ALLOW_REPLACE: true
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```
