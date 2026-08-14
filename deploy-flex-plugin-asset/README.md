[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Deploy Flex Plugin Asset

Publishes a built Flex plugin bundle to Twilio's Serverless asset hosting and returns its public URL — the URL you then hand to [Create Flex Plugin Version](../create-flex-plugin-version/).

It targets the same `default` Functions Service the Flex CLI uses, creating it if the account has never hosted a plugin, and gives each plugin its own Serverless environment so plugins deployed from different repositories cannot overwrite one another's bundles.

## Usage

```yaml
  - name: Upload the plugin bundle
    id: bundle
    uses: step-security/zingdevlimited-actions-helpers/deploy-flex-plugin-asset@v5
    with:
      FILE_PATH: plugin-agent-tools/build/plugin-agent-tools.js
      PLUGIN_NAME: plugin-agent-tools
      PLUGIN_VERSION: 1.4.0
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Show the bundle URL
    run: echo "${{ steps.bundle.outputs.ASSET_URL }}"
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `FILE_PATH` | yes | Path to the compiled bundle, typically under the plugin's `build/` directory. |
| `PLUGIN_NAME` | yes | Plugin name, matching `name` in its `package.json`. |
| `PLUGIN_VERSION` | yes | Plugin version, matching `version` in its `package.json`. |
| `ALLOW_VERSION_OVERWRITE` | no | `true` to permit replacing a bundle already deployed for this version — see below. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `ASSET_URL` | Public URL of the uploaded bundle. |
| `DEPLOY_SID` | SID of the Serverless deployment that made it live. |

## Overwriting a version

By default, finding a bundle already deployed under the same `PLUGIN_VERSION` fails the step. That is deliberate: a plugin version is meant to be immutable, and quietly swapping the bundle behind a released version means agents get different code from the same version number, with no record of the change.

The usual fix is to bump the version in `package.json`. `ALLOW_VERSION_OVERWRITE: true` exists for development environments where re-pushing the same version while iterating is more convenient than bumping it:

```yaml
  - name: Upload the plugin bundle
    uses: step-security/zingdevlimited-actions-helpers/deploy-flex-plugin-asset@v5
    with:
      FILE_PATH: plugin-agent-tools/build/plugin-agent-tools.js
      PLUGIN_NAME: plugin-agent-tools
      PLUGIN_VERSION: 1.4.0
      ALLOW_VERSION_OVERWRITE: ${{ github.ref != 'refs/heads/main' }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## What the step does

1. Finds the Serverless Service with unique name `default`, creating it as `Flex Plugins Default Service` if absent.
2. Finds the environment whose unique name is the plugin name, creating it with a random seven-character domain suffix if absent.
3. Reads the asset versions carried by the environment's current build.
4. Fails if one of those already corresponds to `PLUGIN_VERSION`, unless `ALLOW_VERSION_OVERWRITE` is set.
5. Uploads the bundle as a new asset version.
6. Creates a build combining it with the asset versions from the previous build, so earlier plugin versions stay reachable.
7. Deploys that build to the environment and returns the bundle URL.

Step 6 is why old versions keep working: rolling back a release to an earlier plugin version still finds its bundle at the URL it was registered with.
