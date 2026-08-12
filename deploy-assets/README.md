[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Deploy Assets

Publishes a directory of static files to a Twilio Serverless Service as assets, so audio prompts, TwiML documents and other artefacts your flows depend on ship alongside the code that references them. The Service, Environment and individual Assets are all created on demand, which means the first run needs no manual setup in the Twilio Console.

The directory is walked recursively and each file's path relative to `ASSETS_DIRECTORY` becomes its asset path.

## Usage

```yaml
  - name: Deploy the prompt assets
    uses: step-security/zingdevlimited-actions-helpers/deploy-assets@v4
    with:
      ASSETS_DIRECTORY: assets/prompts
      SERVICE_NAME: ivr-prompts
      ENVIRONMENT_SUFFIX: dev
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `ASSETS_DIRECTORY` | yes | Local directory to publish. Subdirectories are included. |
| `SERVICE_NAME` | yes | Unique name of the Serverless Service, created if absent. |
| `ENVIRONMENT_NAME` | no | Friendly name of the target Environment. Falls back to `ENVIRONMENT_SUFFIX`, then to `production`. |
| `ENVIRONMENT_SUFFIX` | no | Domain suffix for the Environment, which appears in its URL. Falls back to `ENVIRONMENT_NAME`, then to none — giving the Service's production Environment. |
| `UI_EDITABLE` | no | `true` to let the Service be edited in the Twilio Console. |
| `PRESERVE_EXISTING` | no | `true` to add to what is already deployed rather than replacing it — see [Replace or add](#replace-or-add). |
| `REPLACE_MARKERS_IN_EXT` | no | Comma-separated extensions whose contents get [placeholder substitution](#placeholders). |
| `BUILD_POLL_TIMEOUT_SECONDS` | no | How long to wait for the Twilio build. Defaults to `50`, maximum `300`. |
| `BUILD_POLL_INTERVAL_SECONDS` | no | Gap between build status checks. Defaults to `5`, maximum `60`. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Replace or add

By default a deployment **defines** the environment: the build contains only what is in `ASSETS_DIRECTORY`, and anything previously live but absent from this run stops being served. That is what you want for an environment owned entirely by one repository.

`PRESERVE_EXISTING: true` switches to adding instead. The new build carries forward everything already deployed — other assets, any Functions on the Service, and the current build's package dependencies — and layers this run's assets on top. Use it when several workflows publish into one Service, or when the Service also hosts Functions deployed by a different pipeline.

```yaml
  - name: Add the English prompts
    uses: step-security/zingdevlimited-actions-helpers/deploy-assets@v4
    with:
      ASSETS_DIRECTORY: assets/prompts/en
      SERVICE_NAME: shared-assets
      ENVIRONMENT_SUFFIX: dev
      PRESERVE_EXISTING: true
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Build timeouts

Twilio rebuilds the whole Service on each deploy, so the wait scales with the Functions and npm dependencies already on it, not with the number of assets you are adding. A Service carrying a large dependency tree can easily exceed the 50-second default:

```yaml
      BUILD_POLL_TIMEOUT_SECONDS: 300
      BUILD_POLL_INTERVAL_SECONDS: 10
```

## Placeholders

An asset often needs to reference the very URL it is about to be served from, which is not known until the Environment exists. List the extensions to process in `REPLACE_MARKERS_IN_EXT` and the action substitutes placeholders before upload.

| Placeholder | Replaced with |
| --- | --- |
| `{{DOMAIN}}` | Base URL of the target Environment, e.g. `https://ivr-prompts-1234-dev.twil.io` |

Only list text formats — running substitution over a binary file such as an MP3 will corrupt it.

Given `assets/prompts/welcome.xml` in the repository:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>{{DOMAIN}}/audio/welcome.mp3</Play>
</Response>
```

deployed with:

```yaml
  - name: Deploy the prompt assets
    uses: step-security/zingdevlimited-actions-helpers/deploy-assets@v4
    with:
      ASSETS_DIRECTORY: assets/prompts
      SERVICE_NAME: ivr-prompts
      ENVIRONMENT_SUFFIX: dev
      REPLACE_MARKERS_IN_EXT: xml
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

the deployed asset reads:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://ivr-prompts-1234-dev.twil.io/audio/welcome.mp3</Play>
</Response>
```
