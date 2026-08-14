[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Sync

Declares the Sync Documents, Lists, Maps and Streams your application depends on in a JSON file, and makes sure they exist in the target Twilio account before your code runs.

The action is **create-only**. Resources are matched on their Unique Name; anything already present is left exactly as it is, including its data. That way a deploy can be re-run safely and never clobbers state written at runtime or tweaked by hand in the Twilio Console.

## Usage

```yaml
steps:
  - name: Check out the Sync config
    uses: actions/checkout@v7
    with:
      sparse-checkout: sync-config.json
      sparse-checkout-cone-mode: false

  - name: Apply Sync resources
    uses: step-security/zingdevlimited-actions-helpers/update-sync@v4
    with:
      CONFIG_PATH: sync-config.json
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `CONFIG_PATH` | yes | Path to the JSON file described below. Check it out before this step runs. |
| `SERVICE_NAME` | no | Friendly name of the Sync Service to target, created if absent. Leave unset to use the account's default Sync Service. |
| `SERVICE_ACL_ENABLED` | no | `true` to enable ACL enforcement on a newly created Sync Service. Ignored unless `SERVICE_NAME` is set. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `SYNC_SERVICE_SID` | SID of the Sync Service the resources were applied to, or `default` when `SERVICE_NAME` was not supplied. |

## Configuration file

Four optional top-level arrays, each keyed by `uniqueName`:

| Array | Extra fields |
| --- | --- |
| `documents` | `defaultData` — object written as the document body at creation time. `aclPermissions` — see below. |
| `lists` | `aclPermissions` |
| `maps` | `aclPermissions`, and `defaultItems` — array of `{ key, data }` pairs seeded into the map. Missing keys are added; existing keys are untouched. |
| `streams` | none |

`aclPermissions` accepts any of `READ_ONLY`, `WRITE_ONLY` and `READ_WRITE`, and is applied to the resource each run even when the resource itself already existed.

### Example

```json
{
  "documents": [
    {
      "uniqueName": "feature-flags",
      "defaultData": {
        "callbackQueue": false,
        "outboundDialling": true
      },
      "aclPermissions": ["READ_ONLY"]
    }
  ],
  "lists": [
    {
      "uniqueName": "callback-requests",
      "aclPermissions": ["READ_WRITE"]
    }
  ],
  "maps": [
    {
      "uniqueName": "queue-thresholds",
      "defaultItems": [
        {
          "key": "billing",
          "data": { "warnAfterSeconds": 90, "escalateAfterSeconds": 300 }
        },
        {
          "key": "technical",
          "data": { "warnAfterSeconds": 120, "escalateAfterSeconds": 420 }
        }
      ]
    }
  ],
  "streams": [
    { "uniqueName": "agent-events" }
  ]
}
```
