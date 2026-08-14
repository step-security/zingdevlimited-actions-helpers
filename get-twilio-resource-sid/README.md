[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Get Twilio Resource SID

A generic lookup step for pipelines that need a Twilio SID they cannot hard-code. Rather than wrapping one product, it builds a list request from the inputs you give it and returns the SID of the single matching resource.

## How the request is built

Inputs map onto a Twilio list endpoint:

```
https://<TWILIO_AREA>.twilio.com/<VERSION>/<API_TYPE>
```

The action pages through every result, reading the resource array named by the response's own `meta.key`, and then keeps the entries whose `SEARCH_BY` property equals `SEARCH_VALUE`. Exactly one match is expected — zero fails the step unless you set `ALLOW_NO_RESULTS`, and more than one fails so an ambiguous search never quietly resolves to the wrong resource.

**Taskrouter is handled specially.** Almost every Taskrouter resource lives under a Workspace, so the account's Workspace is resolved first and spliced into the path for you:

```
https://taskrouter.twilio.com/<VERSION>/Workspaces/<resolved SID>/<API_TYPE>
```

Asking for `API_TYPE: Workspaces` returns that resolved SID directly, with no search inputs needed.

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `TWILIO_AREA` | yes | Product subdomain, e.g. `sync`, `studio`, `conversations`, `taskrouter`. |
| `API_TYPE` | yes | Resource path segment, e.g. `Services`, `Flows`, `TaskQueues`. |
| `SEARCH_BY` | no | Property to match on, e.g. `unique_name`, `friendly_name`. Omit to take the first resource returned. |
| `SEARCH_VALUE` | no | Value `SEARCH_BY` must equal. |
| `VERSION` | no | API version, `v1` by default. Some products, Studio among them, need `v2`. |
| `ALLOW_NO_RESULTS` | no | `true` to return an empty `SID` instead of failing when nothing matches. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `SID` | SID of the matched resource, or an empty string when nothing matched and `ALLOW_NO_RESULTS` was enabled. |

## Examples

### The default Sync Service

```yaml
  - name: Look up the Sync Service
    id: sync
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: sync
      API_TYPE: Services
      SEARCH_BY: unique_name
      SEARCH_VALUE: default
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Use it
    run: echo "Sync Service ${{ steps.sync.outputs.SID }}"
```

### A Studio Flow, which needs `v2`

```yaml
  - name: Look up the onboarding flow
    id: flow
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: studio
      API_TYPE: Flows
      VERSION: v2
      SEARCH_BY: friendly_name
      SEARCH_VALUE: Customer Onboarding
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

### The Taskrouter Workspace

No search inputs — the account's Workspace is returned as-is.

```yaml
  - name: Look up the Workspace
    id: workspace
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: taskrouter
      API_TYPE: Workspaces
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

### A queue inside that Workspace

The Workspace segment is added automatically.

```yaml
  - name: Look up the billing queue
    id: queue
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: taskrouter
      API_TYPE: TaskQueues
      SEARCH_BY: friendly_name
      SEARCH_VALUE: Billing
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

### A resource that may not exist yet

```yaml
  - name: Look for a previous deployment
    id: previous
    uses: step-security/zingdevlimited-actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: serverless
      API_TYPE: Services
      SEARCH_BY: unique_name
      SEARCH_VALUE: my-api
      ALLOW_NO_RESULTS: true
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: First deployment
    if: steps.previous.outputs.SID == ''
    run: echo "Nothing deployed yet"
```
