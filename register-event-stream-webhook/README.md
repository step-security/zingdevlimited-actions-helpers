[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Register Event Stream Webhook

Points Twilio's [Event Streams](https://www.twilio.com/docs/events) at one of your endpoints, by making sure a webhook Sink exists for the destination URL and that a Subscription attached to it covers exactly the [event types](https://www.twilio.com/docs/events/event-types-list) you list.

Both halves are idempotent, and safe to re-run on every deploy:

- **Sink** — reused when one already delivers to the same `SINK_WEBHOOK_URL`, otherwise created.
- **Subscription** — created on first run. On later runs the subscribed events are reconciled against `EVENT_TYPES`: new entries are added, changed schema versions are updated, and entries you have removed from the list are unsubscribed.

## Usage

Each line of `EVENT_TYPES` is an event name and its schema version, separated by `=`:

```yaml
  - name: Subscribe to task events
    uses: step-security/zingdevlimited-actions-helpers/register-event-stream-webhook@v4
    with:
      SINK_WEBHOOK_URL: https://my-api-1234.twil.io/events/task
      SINK_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: Task event handler
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPTION: Task events
      EVENT_TYPES: |
        com.twilio.taskrouter.task.created=3
        com.twilio.taskrouter.task.updated=3
        com.twilio.taskrouter.task.completed=3
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `SINK_WEBHOOK_URL` | yes | Endpoint Twilio delivers events to. Also the key used to decide whether a Sink already exists. |
| `SINK_WEBHOOK_METHOD` | yes | `POST` or `GET`. |
| `SINK_DESCRIPTION` | yes | Label for the Sink in the Twilio Console. |
| `SINK_BATCH_EVENTS` | yes | `true` to deliver events in batches, `false` to deliver them one at a time. |
| `SUBSCRIPTION_DESCRIPTION` | yes | Label for the Subscription in the Twilio Console. |
| `EVENT_TYPES` | yes | Newline-separated `event.name=schema_version` pairs. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Outputs

| Name | Description |
| --- | --- |
| `SINK_SID` | SID of the Sink, whether it was created now or already present. |
| `SUBSCRIPTION_SID` | SID of the Subscription attached to that Sink. |

## Multiple endpoints

One Sink handles one destination URL, so use a step per endpoint when different handlers need different events:

```yaml
  - name: Subscribe to completed calls
    uses: step-security/zingdevlimited-actions-helpers/register-event-stream-webhook@v4
    with:
      SINK_WEBHOOK_URL: https://my-api-1234.twil.io/events/call-completed
      SINK_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: Call record writer
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPTION: Completed calls
      EVENT_TYPES: |
        com.twilio.voice.status-callback.call.completed=1
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

  - name: Subscribe to outbound messages
    uses: step-security/zingdevlimited-actions-helpers/register-event-stream-webhook@v4
    with:
      SINK_WEBHOOK_URL: https://my-api-1234.twil.io/events/message-sent
      SINK_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: Message audit log
      SINK_BATCH_EVENTS: true
      SUBSCRIPTION_DESCRIPTION: Outbound messages
      EVENT_TYPES: |
        com.twilio.messaging.message.sent=2
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

> [!NOTE]
> Since events absent from `EVENT_TYPES` are unsubscribed, the list has to be the complete set for that Sink. Dropping a line is how you turn an event off.
