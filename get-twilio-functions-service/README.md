[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Get Twilio Functions Service

Resolves a deployed Twilio Functions Service by name and reports back the SIDs and the public base URL of its environment — the details later steps need to configure Studio flows, Flex plugins or anything else that has to call your Functions.

## Usage

```yaml
  - name: Look up the API service
    id: api
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-functions-service@v4
    with:
      SERVICE_NAME: my-api
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Use the results
    run: |
      echo "Base URL:    ${{ steps.api.outputs.BASE_URL }}"
      echo "Service SID: ${{ steps.api.outputs.SERVICE_SID }}"
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `SERVICE_NAME` | yes | Unique name of the Functions Service. Treated as a substring when `IS_PATTERN` is on. |
| `ENVIRONMENT_SUFFIX` | no | Domain suffix of the environment to read, for services with more than one. Defaults to the first environment returned. |
| `IGNORE_NOT_FOUND` | no | `true` to return empty strings for every output instead of failing when the service does not exist. |
| `IS_PATTERN` | no | `true` to treat `SERVICE_NAME` as a substring — see [Matching generated names](#matching-generated-names). |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `BASE_URL` | Public root URL of the environment, e.g. `https://my-api-1234-dev.twil.io`. |
| `SERVICE_SID` | SID of the Functions Service. |
| `ENVIRONMENT_SID` | SID of the environment that was read. |
| `BUILD_SID` | SID of the build currently deployed to that environment, or empty if nothing has been deployed. |
| `RESOLVED_SERVICE_NAME` | Unique name of the service that was matched. |

## Matching generated names

Services installed from the Twilio Flex plugin library get a generated unique name carrying a version and a random suffix, something like `plibo-queued-callback-and-voicemail-1-1-5-6672-kaqfvd`. You cannot know that string ahead of time, so `IS_PATTERN: true` switches matching to "first service whose unique name contains `SERVICE_NAME`":

```yaml
  - name: Look up the callback service
    id: callback
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-functions-service@v4
    with:
      SERVICE_NAME: plibo-queued-callback-and-voicemail
      IS_PATTERN: true
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Use the results
    run: |
      echo "Matched:  ${{ steps.callback.outputs.RESOLVED_SERVICE_NAME }}"
      echo "Base URL: ${{ steps.callback.outputs.BASE_URL }}"
```

Read `RESOLVED_SERVICE_NAME` to find out which service the pattern actually landed on. Keep the pattern specific enough to be unambiguous, since the first match wins.

> [!NOTE]
> `IGNORE_NOT_FOUND` is not honoured in pattern mode — a pattern matching nothing always fails the step, on the basis that a pattern with no match usually means the plugin was never installed.
