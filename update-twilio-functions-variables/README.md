[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Twilio Functions Variables

Applies the environment variables of a deployed Twilio Functions Service from a `.env`-style block in your workflow, so the SIDs and credentials your Functions read at runtime are set by the same pipeline that deployed them.

`VARIABLES_ENV` is treated as the full set for the environment. Variables on the Service that are missing from it are deleted, which keeps a variable removed from the workflow from lingering in the account.

## Usage

```yaml
  - name: Apply Functions variables
    uses: step-security/zingdevlimited-actions-helpers/update-twilio-functions-variables@v4
    with:
      SERVICE_NAME: my-api
      VARIABLES_ENV: |
        TWILIO_WORKSPACE_SID=${{ steps.workspace.outputs.SID }}
        TWILIO_SYNC_SERVICE_SID=${{ steps.sync.outputs.SID }}
        CRM_API_URL=${{ vars.CRM_API_URL }}
        CRM_API_TOKEN=${{ secrets.CRM_API_TOKEN }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `SERVICE_NAME` | yes | Unique name of the Functions Service to update. |
| `VARIABLES_ENV` | yes | One `KEY=VALUE` per line. |
| `ENVIRONMENT_SUFFIX` | no | Domain suffix of the environment to target, for Services with more than one. |
| `OPTIONAL_VARIABLES` | no | Comma-separated keys allowed to be empty — see below. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Writing the variable block

Values are taken literally to the end of the line, so do not add quotes — `TOKEN="abc"` stores the quote characters as part of the value.

An empty value normally fails the step, on the assumption that an expression resolving to nothing means a secret is missing or an earlier step did not produce the output it was meant to. That check is what catches a mistyped secret name before it reaches production.

Where a variable really is optional, list its key in `OPTIONAL_VARIABLES`:

```yaml
  - name: Apply Functions variables
    uses: step-security/zingdevlimited-actions-helpers/update-twilio-functions-variables@v4
    with:
      SERVICE_NAME: my-api
      OPTIONAL_VARIABLES: DEBUG_WEBHOOK_URL,FEATURE_FLAG_OVERRIDES
      VARIABLES_ENV: |
        TWILIO_WORKSPACE_SID=${{ steps.workspace.outputs.SID }}
        DEBUG_WEBHOOK_URL=${{ vars.DEBUG_WEBHOOK_URL }}
        FEATURE_FLAG_OVERRIDES=${{ vars.FEATURE_FLAG_OVERRIDES }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

A listed key that comes through empty is skipped rather than written, leaving whatever the Service already had in place.
