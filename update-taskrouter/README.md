[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Taskrouter

Describes a Taskrouter Workspace — its activities, task channels, queues and workflows — in a JSON file, and reconciles the target Twilio account against it on every deploy.

Resources are matched by friendly name (task channels by unique name). An unmatched name is created; a matched one is updated in place, so SIDs stay stable across deploys and anything referencing them keeps working. If a matched resource already agrees with the config, the action skips the write and logs it as `(Unchanged)`.

## Usage

```yaml
steps:
  - name: Check out the Taskrouter config
    uses: actions/checkout@v7
    with:
      sparse-checkout: taskrouter-config.json
      sparse-checkout-cone-mode: false

  - name: Apply Taskrouter configuration
    uses: step-security/zingdevlimited-actions-helpers/update-taskrouter@v5
    with:
      CONFIG_PATH: taskrouter-config.json
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `CONFIG_PATH` | yes | Path to the JSON file described below. Check it out before this step runs. |
| `WORKSPACE_NAME` | no | Friendly name of the Workspace to target, created if no Workspace has that name. Leave unset on Flex accounts to use the account's first Workspace. |
| `WORKSPACE_CALLBACK_URL` | no | Event callback URL for the Workspace. Overridden by `workspace.eventCallbackUrl` in the config file if that is also set. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `RESOURCES` | JSON object with `activities`, `channels`, `queues`, `workflows` and `workspace` keys, each mapping the name from your config to the Twilio resource it resolved to. Useful for reading a `sid` out in a later step. |
| `WORKSPACE_SID` | SID of the Workspace that was targeted. |

## Choosing a Workspace

Flex accounts come with one Workspace, and leaving `WORKSPACE_NAME` unset simply picks it up. On a non-Flex account, or when you keep more than one Workspace, name the one you mean:

```yaml
  - name: Apply Taskrouter configuration
    uses: step-security/zingdevlimited-actions-helpers/update-taskrouter@v5
    with:
      CONFIG_PATH: taskrouter-config.json
      WORKSPACE_NAME: Support Workspace
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

A name that matches nothing gets created, which makes this the way to stand up a Workspace from scratch.

## Configuration file

Every top-level key is optional — include only the resource types you want managed.

### `activities`

| Field | Required | Description |
| --- | --- | --- |
| `friendlyName` | yes | Activity name. |
| `available` | yes | Whether workers in this activity can be assigned tasks. |

Twilio does not allow an activity's `available` flag to change after creation, so existing activities are reported and left as they are.

### `channels`

| Field | Required | Description |
| --- | --- | --- |
| `uniqueName` | yes | Programmatic name, and the value used for matching. |
| `friendlyName` | yes | Display name. |
| `channelOptimizedRouting` | no | Enables channel-optimised routing. |

### `queues`

| Field | Required | Description |
| --- | --- | --- |
| `friendlyName` | yes | Queue name. |
| `targetWorkers` | no | Worker-selection expression, e.g. `routing.skills HAS 'billing'`. |
| `maxReservedWorkers` | no | Reservations offered simultaneously for one task. |
| `taskOrder` | no | `FIFO` or `LIFO`. |
| `assignmentActivity` | no | Activity a worker moves into when a task is assigned — an [activity reference](#references). |
| `reservationActivity` | no | Activity a worker moves into while a reservation is pending — an [activity reference](#references). |

### `workflows`

| Field | Required | Description |
| --- | --- | --- |
| `friendlyName` | yes | Workflow name. |
| `configuration` | yes | Twilio workflow routing document, except that each `queue` is a [queue reference](#references) rather than a raw SID. |
| `assignmentCallbackUrl` | no | Assignment callback URL. |
| `fallbackAssignmentCallbackUrl` | no | Callback used when the primary one fails. |
| `taskReservationTimeout` | no | Reservation timeout in seconds. |

### `workspace`

| Field | Required | Description |
| --- | --- | --- |
| `defaultActivity` | no | Activity new workers start in — an [activity reference](#references). |
| `timeoutActivity` | no | Activity workers fall back to after a timeout — an [activity reference](#references). |
| `eventCallbackUrl` | no | Workspace event callback URL. |
| `eventsFilter` | no | Array of event names to send to the callback. |
| `prioritizeQueueOrder` | no | `FIFO` or `LIFO`. |

### References

Anywhere an activity or queue is referenced, give an object rather than a SID:

```json
{ "friendlyName": "Awaiting Callback" }
```

or, if you already know it:

```json
{ "sid": "WAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

References resolve against resources created earlier in the same run, so a queue can point at an activity defined in the same file and a workflow can point at a queue defined alongside it.

### Example

```json
{
  "activities": [
    { "friendlyName": "Wrap Up", "available": false },
    { "friendlyName": "Coaching", "available": false }
  ],
  "channels": [
    {
      "uniqueName": "callback",
      "friendlyName": "Scheduled Callback",
      "channelOptimizedRouting": true
    }
  ],
  "queues": [
    {
      "friendlyName": "Billing",
      "targetWorkers": "routing.skills HAS 'billing'",
      "taskOrder": "FIFO",
      "assignmentActivity": { "friendlyName": "Wrap Up" }
    },
    {
      "friendlyName": "Everyone",
      "targetWorkers": "1==1"
    }
  ],
  "workflows": [
    {
      "friendlyName": "Inbound Voice",
      "taskReservationTimeout": 120,
      "configuration": {
        "task_routing": {
          "filters": [
            {
              "filter_friendly_name": "Billing enquiries",
              "expression": "skillNeeded == 'billing'",
              "targets": [
                { "queue": { "friendlyName": "Billing" } }
              ]
            }
          ],
          "default_filter": {
            "queue": { "friendlyName": "Everyone" }
          }
        }
      }
    }
  ],
  "workspace": {
    "defaultActivity": { "friendlyName": "Offline" },
    "timeoutActivity": { "friendlyName": "Unavailable" },
    "eventCallbackUrl": "https://example.com/taskrouter-events",
    "eventsFilter": ["task.created", "task.completed", "task.canceled"],
    "prioritizeQueueOrder": "FIFO"
  }
}
```
