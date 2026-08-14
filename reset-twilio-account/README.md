[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Reset Twilio Account

Tears selected areas of a Twilio account back down to something close to a freshly provisioned state. It exists for development and test accounts that have accumulated junk, or that a failed deploy left half-configured.

> [!CAUTION]
> **Every deletion this action performs is permanent.** There is no undo, no soft delete and no export. Point it at a development account only, and gate the job so it cannot be triggered against anything else.
>
> "Default state" is also a moving target — Twilio changes what a new account looks like, and this action reflects those defaults as of its last update rather than tracking them automatically.

## Usage

Nothing happens unless you opt an area in, so the input list doubles as the blast radius. The `if` condition below is the pattern worth copying: it stops the job running on a fork or a customer's copy of the repository.

```yaml
jobs:
  reset:
    if: github.repository_owner == 'your-org'
    runs-on: ubuntu-24.04
    steps:
      - name: Reset the development account
        uses: step-security/zingdevlimited-actions-helpers/reset-twilio-account@v5
        with:
          TWILIO_API_KEY: ${{ vars.DEV_TWILIO_API_KEY }}
          TWILIO_API_SECRET: ${{ secrets.DEV_TWILIO_API_SECRET }}
          TASKROUTER: true
          SYNC: true
          STUDIO: true
          SERVERLESS: true
          FLEX_CUSTOM_PLUGINS: true
          FLEX_UI_ATTRIBUTES: true
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |
| `TASKROUTER` | no | `true` to reset Taskrouter — see below. |
| `SYNC` | no | `true` to reset Sync. |
| `STUDIO` | no | `true` to reset Studio. |
| `SERVERLESS` | no | `true` to reset Serverless. |
| `FLEX_CUSTOM_PLUGINS` | no | `true` to disable custom Flex plugins. |
| `FLEX_UI_ATTRIBUTES` | no | `true` to reset the Flex UI attributes. |

## What each area does

### `TASKROUTER`

Operates on the account's first Workspace, which on a Flex account is the only one.

- Deletes every Task and every Worker.
- Deletes every Workflow and TaskQueue, then recreates the `Everyone` queue (targeting all workers, FIFO) and the `Assign to Anyone` workflow that routes to it.
- Deletes any Activity outside the default four, and recreates whichever of `Offline`, `Available`, `Unavailable` and `Break` are missing.
- Points the Workspace's default and timeout activity at `Offline`, clears its event callback and sets queue order to FIFO.

Task channels are left alone.

### `SYNC`

- Deletes every Sync Service other than the one whose unique name is `default`.
- Empties the default service of its Documents, Lists, Maps and Streams.

### `STUDIO`

- Deletes every Studio Flow.

### `SERVERLESS`

- Deletes every Functions Service other than the one whose unique name is `default`.

### `FLEX_CUSTOM_PLUGINS`

Publishes a Flex Release with an empty plugin configuration, which switches every custom plugin off.

Plugins are **not** archived, since archiving cannot be reversed. They stay in the account, disabled, and can be re-enabled by publishing another release.

### `FLEX_UI_ATTRIBUTES`

Overwrites `ui_attributes` in the Flex Configuration with the stock defaults — browser notifications off, light theme, version compatibility on and warm transfers enabled.

This replaces the whole object, so configuration written there by plugins goes with it. Uninstall Library plugins before using this option, or they will be left pointing at settings that no longer exist.
