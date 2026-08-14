[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Setup Flex CLI

Installs the Twilio CLI and its Flex plugin into the running job, pinning the Flex plugin to the `@twilio/flex-plugin-scripts` version your plugin already depends on so the CLI cannot drift away from the toolchain that built the bundle.

The version is read straight out of the plugin's `package.json`, along with its name and version, which are returned as outputs.

> [!WARNING]
> The Flex CLI is fragile in CI — installation reaches out to several registries and its plugin resolution is sensitive to the Node version in play. Where a workflow only needs to publish a bundle and register a plugin version, the [Deploy Flex Plugin Asset](../deploy-flex-plugin-asset/) and [Create Flex Plugin Version](../create-flex-plugin-version/) actions do that against the Twilio API directly, with no CLI involved. Reach for this action only when you specifically need the CLI itself.

## Usage

Node has to be set up first, since the CLI and its plugin are installed with npm — and the version matters, see [Node compatibility](#node-compatibility).

```yaml
  - name: Set up Node
    uses: actions/setup-node@v7
    with:
      node-version: 22.x
      cache: yarn
      cache-dependency-path: yarn.lock

  - name: Install the Flex CLI
    id: flexCli
    uses: step-security/zingdevlimited-actions-helpers/setup-flex-cli@v4
    with:
      PLUGIN_DIRECTORY: plugin-agent-tools

  - name: Report what was installed
    run: |
      echo "Plugin:  ${{ steps.flexCli.outputs.PLUGIN_NAME }}"
      echo "Version: ${{ steps.flexCli.outputs.PLUGIN_VERSION }}"
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `PLUGIN_DIRECTORY` | yes | Directory holding the plugin's `package.json`. |

## Outputs

| Name | Description |
| --- | --- |
| `PLUGIN_NAME` | `name` from the plugin's `package.json`. |
| `PLUGIN_VERSION` | `version` from the plugin's `package.json`. |

The npm and Twilio CLI directories are cached, keyed on the resolved plugin-scripts version, so repeat runs skip most of the download.

## Node compatibility

Twilio releases `@twilio-labs/plugin-flex` in lockstep with `@twilio/flex-plugin-scripts`, and every release declares a closed `engines.node` range. Because this action installs the plugin at whatever version your `package.json` pins, the Node you set up has to fall inside that release's range:

| `@twilio/flex-plugin-scripts` | Supported Node |
| --- | --- |
| 6.0.x | `^12 \|\| ^14 \|\| ^16` |
| 6.1.x | `^14 \|\| ^16 \|\| ^18` |
| 6.3.x | `^14 \|\| ^16 \|\| ^18 \|\| ^20` |
| 7.0.x | `^16 \|\| ^18 \|\| ^20` |
| 7.1.x | `^16 \|\| ^18 \|\| ^20 \|\| ^22` |

Two consequences worth planning around:

- **Node 24 does not work with any version.** Even the newest plugin release stops at `^22`, so a job on Node 24 cannot install the Flex CLI regardless of what you pin. Use Node 22 until Twilio widens the range.
- **An older pin narrows your options sharply.** On `flex-plugin-scripts` 6.0.x the ceiling is Node 16, which has been end-of-life since September 2023. If that is where you are, upgrading the plugin toolchain is the fix, not downgrading the runner.

The action checks this before installing and fails with the offending version and the Node to use instead, rather than letting it surface as yarn's `The engine "node" is incompatible with this module`. If the range cannot be read or has an unfamiliar shape, the check warns and continues rather than blocking the install.
