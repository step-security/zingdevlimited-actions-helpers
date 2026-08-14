[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Actions Helpers

A StepSecurity-maintained set of [custom actions](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions) for building and deploying Twilio Flex, Twilio Functions and Azure-hosted applications from GitHub Actions.

> This is a secure drop-in replacement for [zingdevlimited/actions-helpers](https://github.com/zingdevlimited/actions-helpers) — the inputs, outputs and behaviour match, so switching over is a change of `uses:` and nothing else. Learn more at [docs.stepsecurity.io](https://docs.stepsecurity.io/github-actions/actions/stepsecurity-maintained-actions).

## Twilio

| Action | What it does |
| --- | --- |
| [Get Twilio Resource SID](./get-twilio-resource-sid/) | Looks up the SID of any Twilio resource by name. |
| [Update Taskrouter](./update-taskrouter/) | Reconciles activities, channels, queues and workflows against a JSON config. |
| [Update Sync](./update-sync/) | Creates the Sync documents, lists, maps and streams an app depends on. |
| [Update Content Templates](./update-content-templates/) | Applies Content Template definitions from a JSON config. |
| [Register Event Stream Webhook](./register-event-stream-webhook/) | Wires an Event Streams sink and subscription to one of your endpoints. |
| [Reset Twilio Account](./reset-twilio-account/) | Returns selected areas of a development account to a baseline state. |

## Twilio Functions

| Action | What it does |
| --- | --- |
| [Get Twilio Functions Service](./get-twilio-functions-service/) | Resolves a deployed Functions Service to its SIDs and base URL. |
| [Update Twilio Functions Variables](./update-twilio-functions-variables/) | Applies a Functions environment's variables from a `.env` block. |
| [Deploy Assets](./deploy-assets/) | Publishes a directory of static files as Serverless assets. |

## Twilio Flex

| Action | What it does |
| --- | --- |
| [Update Flex Config](./update-flex-config/) | Writes a JSON section into the Flex Configuration `ui_attributes`. |
| [Update Flex Skills](./update-flex-skills/) | Maintains the worker skill list, with or without proficiency levels. |
| [Set Flex Teams](./set-flex-teams/) | Keeps the three-tier team hierarchy in step with a JSON config. |
| [Setup Flex CLI](./setup-flex-cli/) | Installs the Twilio CLI and Flex plugin at the version a plugin expects. |
| [Deploy Flex Plugin Asset](./deploy-flex-plugin-asset/) | Publishes a plugin bundle and returns its hosted URL. |
| [Create Flex Plugin Version](./create-flex-plugin-version/) | Registers a plugin version against a published bundle. |
| [Release Flex Plugin Versions](./release-flex-plugin-versions/) | Publishes a Flex release from a set of plugin versions. |
| [Install Library Flex Plugin](./install-library-flex-plugin/) | Installs and configures a plugin from the Flex Plugin Library. |

## Azure

| Action | What it does |
| --- | --- |
| [Format App Settings](./azure/format-app-settings/) | Converts `KEY=VALUE` lines into Azure app settings JSON, optionally encrypted. |
| [Terraform Init](./azure/terraform-init/) | Initialises Terraform against an Azure Blob Storage backend. |
| [Terraform Output](./azure/terraform-output/) | Reads Terraform outputs from a state file in Azure Blob Storage. |
