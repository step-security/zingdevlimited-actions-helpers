[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Flex Config

Stores a block of JSON under a named key inside `ui_attributes` in the [Flex Configuration](https://www.twilio.com/docs/flex/developer/config/flex-configuration-rest-api). This is the usual way to get environment-specific settings — API base URLs, feature flags, timeouts — in front of a Flex plugin, which reads them from the Flex UI at runtime.

The named section is replaced wholesale on each run, while every other key in `ui_attributes` and the rest of the Flex Configuration is merged through untouched. That keeps one plugin's deploy from disturbing another's settings, but it also means the JSON you pass has to be the complete section — a key you drop from it disappears from the account.

## Usage

```yaml
  - name: Publish the plugin configuration
    uses: step-security/zingdevlimited-actions-helpers/update-flex-config@v5
    with:
      CONFIG_SECTION: crmConnector
      CONFIG_DATA_JSON: |
        {
          "apiBaseUrl": "${{ vars.CRM_API_URL }}",
          "requestTimeoutMs": 10000,
          "debugLogging": false
        }
      TWILIO_ACCOUNT_SID: ${{ vars.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

Which leaves the Flex Configuration holding:

```json
{
  "ui_attributes": {
    "crmConnector": {
      "apiBaseUrl": "https://crm.example.com/api",
      "requestTimeoutMs": 10000,
      "debugLogging": false
    }
  }
}
```

The plugin then reads it from the Flex manager's configuration under the same key.

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `CONFIG_SECTION` | yes | Key under `ui_attributes` to write. Conventionally one section per plugin. |
| `CONFIG_DATA_JSON` | yes | JSON object to store there. Validated before anything is sent, so malformed JSON fails the step rather than the account. |
| `TWILIO_ACCOUNT_SID` | yes | Account SID whose Flex Configuration is being written. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

The action writes a copy of the section it applied to the job summary, which is handy when reviewing what a deploy changed.

> [!WARNING]
> Everything in `ui_attributes` is readable by any signed-in Flex user, because the Flex UI has to fetch it. Never put secrets here — pass those to a Twilio Function environment variable instead.
