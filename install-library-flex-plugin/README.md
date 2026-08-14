[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Install Library Flex Plugin

Installs a plugin from the [Flex Plugin Library](https://flex.twilio.com/admin/plugins/library) without going through the Flex admin UI, so a rebuilt environment ends up with the same library plugins as the one it replaces.

Installation is asynchronous on Twilio's side. The action submits the install and then polls until it reports success, failing the step if it does not complete, so a later step never runs against a half-installed plugin.

## Usage

```yaml
  - name: Install the chat transfer plugin
    uses: step-security/zingdevlimited-actions-helpers/install-library-flex-plugin@v5
    with:
      FLEX_UI_VERSION: 2.9.1
      PLUGIN_NAME: plibo-chat-transfer
      VERSION_SID: JH00000000000000000000000000000000
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
    env:
      ATTRIBUTE_TWILIO_FLEX_WORKSPACE_SID: ${{ steps.workspace.outputs.SID }}
      ATTRIBUTE_TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID: ${{ steps.transferWorkflow.outputs.SID }}
      ATTRIBUTE_TWILIO_FLEX_CONFIG_CONVERSATION_TRANSFER: |
        {
          "enabled": true,
          "multi_participant": true,
          "cold_transfer": true
        }
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `FLEX_UI_VERSION` | yes | Flex UI version live on the account. The library serves plugin builds per UI version, so this has to match. |
| `PLUGIN_NAME` | yes | Kebab-case library identifier of the plugin, e.g. `plibo-chat-transfer`. |
| `VERSION_SID` | yes | SID of the plugin version to install, beginning `JH`. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Plugin attributes

Library plugins are configured by attributes passed at install time. Rather than a single opaque blob, each attribute is supplied as an environment variable prefixed `ATTRIBUTE_`; the prefix is stripped and the remainder becomes the attribute name, so `ATTRIBUTE_TWILIO_FLEX_WORKSPACE_SID` sets `TWILIO_FLEX_WORKSPACE_SID`.

Values are sent as given, which lets an attribute be a plain SID or a block of JSON, as in the example above. Because they are ordinary environment variables, they can be wired to outputs from earlier steps — which is the point, since the SIDs a plugin needs are usually created by the same pipeline.

## Finding the inputs

Neither the version SID nor a plugin's attribute names are published in a machine-readable form, so read them off a manual install once:

1. Open the [Flex Plugin Library](https://flex.twilio.com/admin/plugins/library) and select the plugin.
2. Open your browser's developer tools on the Network tab.
3. Start the install.
4. Find the outgoing `Install` request and inspect its payload:
   - `plugin_version_sid` is the value for `VERSION_SID`.
   - Each entry of `attributes` gives you a name to prefix with `ATTRIBUTE_`.

Note the SID down with the plugin version it corresponds to — it identifies one specific version, so upgrading the plugin later means finding a new SID the same way.
