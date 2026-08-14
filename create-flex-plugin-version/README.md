[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Create Flex Plugin Version

Registers a [Plugin Version](https://www.twilio.com/docs/flex/developer/plugins/api/plugin-version) against an existing Flex Plugin, pointing it at a bundle you have already published. This is the step between uploading a bundle and putting it live in a release.

Re-running with a version that is already registered is not an error: the existing version's SID is returned and nothing is changed, so a re-run of a deploy is harmless.

## Usage

Pair it with [Deploy Flex Plugin Asset](../deploy-flex-plugin-asset/), which produces the bundle URL:

```yaml
  - name: Upload the plugin bundle
    id: bundle
    uses: step-security/zingdevlimited-actions-helpers/deploy-flex-plugin-asset@v4
    with:
      FILE_PATH: plugin-agent-tools/build/plugin-agent-tools.js
      PLUGIN_NAME: plugin-agent-tools
      PLUGIN_VERSION: 1.4.0
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Register the plugin version
    id: version
    uses: step-security/zingdevlimited-actions-helpers/create-flex-plugin-version@v4
    with:
      PLUGIN_NAME: plugin-agent-tools
      PLUGIN_VERSION: 1.4.0
      ASSET_URL: ${{ steps.bundle.outputs.ASSET_URL }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `PLUGIN_NAME` | yes | Unique name of the Flex Plugin. It must already exist in the account. |
| `PLUGIN_VERSION` | yes | Semantic version to register. |
| `ASSET_URL` | yes | URL of the published bundle. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `PLUGIN_VERSION_SID` | SID of the Plugin Version, whether created now or already present. Feed this into [Release Flex Plugin Versions](../release-flex-plugin-versions/). |

## Where the bundle needs to live

Flex does not copy the bundle. Every time an agent loads Flex, the browser is directed to `ASSET_URL` and Twilio signs the request with an `X-Twilio-Signature` header.

That has a practical consequence: **the URL must stay reachable for as long as the version might be released.** Pointing it at a temporary artifact, a preview deployment, or a bucket subject to a lifecycle rule means agents will eventually fail to load the plugin — possibly long after the deploy that looked successful. Twilio's own Serverless asset hosting, which is what [Deploy Flex Plugin Asset](../deploy-flex-plugin-asset/) uses, is the safe default.
