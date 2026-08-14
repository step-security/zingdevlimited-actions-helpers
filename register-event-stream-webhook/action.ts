import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioGet, twilioPost, twilioDelete, twilioGetAllPages } from '../_lib/twilio';

const EVENTS = 'https://events.twilio.com/v1';

export async function run(): Promise<void> {
  await validateSubscription();

  const sinkWebhookUrl = getInput('SINK_WEBHOOK_URL', true);
  const sinkWebhookMethod = getInput('SINK_WEBHOOK_METHOD', true);
  const sinkDescription = getInput('SINK_DESCRIPTION', true);
  const sinkBatchEvents = getInput('SINK_BATCH_EVENTS', true);
  const subscriptionDescription = getInput('SUBSCRIPTION_DESCRIPTION', true);
  const eventTypesRaw = getInput('EVENT_TYPES', true);
  const auth = getAuth();

  const eventTypes = eventTypesRaw.split('\n')
    .map((l: string) => l.split('='))
    .filter((p: string[]) => p.length === 2)
    .map(([type, version]: string[]) => ({ type: type.trim(), schema_version: parseInt(version.trim(), 10) }));

  const sinks = await twilioGetAllPages(`${EVENTS}/Sinks`, auth, 'sinks');
  let sink: any = sinks.find((s: any) => s.sink_configuration?.destination === sinkWebhookUrl);

  if (!sink) {
    const { data } = await twilioPost(`${EVENTS}/Sinks`, auth, {
      Description: sinkDescription,
      SinkType: 'webhook',
      SinkConfiguration: JSON.stringify({
        destination: sinkWebhookUrl,
        method: sinkWebhookMethod,
        batch_events: sinkBatchEvents === 'true',
      }),
    });
    sink = data;
    console.log(`Created Event Sink '${sinkDescription}': ${sinkWebhookMethod} ${sinkWebhookUrl}`);
  }

  const subscriptionsRes = await twilioGet(`${EVENTS}/Subscriptions?SinkSid=${sink.sid}`, auth);
  const subscriptions = subscriptionsRes.subscriptions ?? [];
  let subscription: any;

  if (subscriptions.length) {
    subscription = subscriptions[0];
    const subUrl = `${EVENTS}/Subscriptions/${subscription.sid}`;
    const subscribedRes = await twilioGet(`${subUrl}/SubscribedEvents`, auth);
    const currentEvents = subscribedRes.types ?? [];

    await Promise.all(eventTypes
      .filter((e: any) => !currentEvents.some((c: any) => c.type === e.type))
      .map((e: any) => twilioPost(`${subUrl}/SubscribedEvents`, auth, {
        Type: e.type, SchemaVersion: e.schema_version.toString(),
      }).then(() => console.log(`Added event: ${e.type}/v${e.schema_version}`))));

    await Promise.all(eventTypes
      .filter((e: any) => { const c = currentEvents.find((c: any) => c.type === e.type); return c && c.schema_version !== e.schema_version; })
      .map((e: any) => twilioPost(`${subUrl}/SubscribedEvents/${e.type}`, auth, { SchemaVersion: e.schema_version.toString() })
        .then(() => console.log(`Updated event: ${e.type} -> v${e.schema_version}`))));

    await Promise.all(currentEvents
      .filter((c: any) => !eventTypes.some((e: any) => e.type === c.type))
      .map((c: any) => twilioDelete(`${subUrl}/SubscribedEvents/${c.type}`, auth)
        .then(() => console.log(`Deleted event: ${c.type}`))));
  } else {
    const params = new URLSearchParams({ Description: subscriptionDescription, SinkSid: sink.sid });
    for (const e of eventTypes) params.append('Types', JSON.stringify(e));
    const { data } = await twilioPost(`${EVENTS}/Subscriptions`, auth, params);
    subscription = data;
    console.log(`Created Subscription '${subscriptionDescription}'`);
  }

  setOutput('SINK_SID', sink.sid);
  setOutput('SUBSCRIPTION_SID', subscription.sid);
}
