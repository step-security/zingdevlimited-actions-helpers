import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPost, twilioDelete, twilioGetAllPages, twilioPostJson } from '../_lib/twilio';

const TR = 'https://taskrouter.twilio.com/v1';
const SYNC = 'https://sync.twilio.com/v1';
const STUDIO = 'https://studio.twilio.com/v2';
const SERVERLESS = 'https://serverless.twilio.com/v1';
const FLEX = 'https://flex-api.twilio.com/v1';

async function deleteAll(baseUrl: string, listKey: string, auth: string): Promise<void> {
  const items = await twilioGetAllPages(baseUrl, auth, listKey);
  await Promise.all(items.map((i: any) => twilioDelete(`${baseUrl}/${i.sid}`, auth)));
  console.log(`Deleted ${items.length} ${listKey}`);
}

async function resetTaskrouter(auth: string): Promise<void> {
  const workspaces = await twilioGetAllPages(`${TR}/Workspaces`, auth, 'workspaces');
  if (!workspaces.length) return;
  const wsUrl = `${TR}/Workspaces/${workspaces[0].sid}`;

  await deleteAll(`${wsUrl}/Tasks`, 'tasks', auth);
  await deleteAll(`${wsUrl}/Workers`, 'workers', auth);

  const queues = await twilioGetAllPages(`${wsUrl}/TaskQueues`, auth, 'task_queues');
  const workflows = await twilioGetAllPages(`${wsUrl}/Workflows`, auth, 'workflows');
  await Promise.all(workflows.map((w: any) => twilioDelete(`${wsUrl}/Workflows/${w.sid}`, auth)));
  await Promise.all(queues.map((q: any) => twilioDelete(`${wsUrl}/TaskQueues/${q.sid}`, auth)));

  const everyoneQueue = await twilioPost(`${wsUrl}/TaskQueues`, auth, {
    FriendlyName: 'Everyone', TargetWorkers: '1==1', TaskOrder: 'FIFO',
    MaxReservedWorkers: '1',
  });
  const config = JSON.stringify({ task_routing: { filters: [], default_filter: { queue: everyoneQueue.data.sid } } });
  await twilioPost(`${wsUrl}/Workflows`, auth, {
    FriendlyName: 'Assign to Anyone', TaskReservationTimeout: '120',
    AssignmentCallbackUrl: '', FallbackAssignmentCallbackUrl: '', Configuration: config,
  });

  const activities = await twilioGetAllPages(`${wsUrl}/Activities`, auth, 'activities');
  const defaults = ['Offline', 'Available', 'Unavailable', 'Break'];
  await Promise.all(activities.filter((a: any) => !defaults.includes(a.friendly_name)).map((a: any) => twilioDelete(`${wsUrl}/Activities/${a.sid}`, auth)));
  for (const name of defaults) {
    if (!activities.find((a: any) => a.friendly_name === name)) {
      await twilioPost(`${wsUrl}/Activities`, auth, { FriendlyName: name, Available: (name === 'Available').toString() });
    }
  }
  const offline = activities.find((a: any) => a.friendly_name === 'Offline') ?? (await twilioGet(`${wsUrl}/Activities`, auth)).activities.find((a: any) => a.friendly_name === 'Offline');
  if (offline) {
    await twilioPost(wsUrl, auth, { DefaultActivitySid: offline.sid, TimeoutActivitySid: offline.sid, EventCallbackUrl: '', PrioritizeQueueOrder: 'FIFO' });
  }
  console.log('Taskrouter reset complete.');
}

async function resetSync(auth: string): Promise<void> {
  const services = await twilioGetAllPages(`${SYNC}/Services`, auth, 'services');
  await Promise.all(services.filter((s: any) => s.unique_name !== 'default').map((s: any) => twilioDelete(`${SYNC}/Services/${s.sid}`, auth)));
  const defaultSvc = services.find((s: any) => s.unique_name === 'default');
  if (defaultSvc) {
    const base = `${SYNC}/Services/${defaultSvc.sid}`;
    await deleteAll(`${base}/Documents`, 'documents', auth);
    await deleteAll(`${base}/Lists`, 'lists', auth);
    await deleteAll(`${base}/Maps`, 'maps', auth);
    await deleteAll(`${base}/Streams`, 'streams', auth);
  }
  console.log('Sync reset complete.');
}

async function resetStudio(auth: string): Promise<void> {
  await deleteAll(`${STUDIO}/Flows`, 'flows', auth);
  console.log('Studio reset complete.');
}

async function resetServerless(auth: string): Promise<void> {
  const services = await twilioGetAllPages(`${SERVERLESS}/Services`, auth, 'services');
  await Promise.all(services.filter((s: any) => s.unique_name !== 'default').map((s: any) => twilioDelete(`${SERVERLESS}/Services/${s.sid}`, auth)));
  console.log('Serverless reset complete.');
}

async function disableCustomFlexPlugins(auth: string): Promise<void> {
  const { data: config } = await twilioPost(`${FLEX}/PluginService/Configurations`, auth, { Name: 'Disable All Custom Plugins' });
  await twilioPost(`${FLEX}/PluginService/Releases`, auth, { ConfigurationId: config.sid });
  console.log('All custom Flex plugins disabled.');
}

async function resetFlexUiAttributes(auth: string): Promise<void> {
  const currentConfig = await twilioGet(`${FLEX}/Configuration`, auth);
  const defaults = {
    notifications: { browser: false },
    theme: { isLight: true },
    version_compatibility: 'yes',
    warmTransfers: { enabled: true },
  };
  await twilioPostJson(`${FLEX}/Configuration`, auth, {
    account_sid: currentConfig.account_sid,
    ui_attributes: defaults,
  });
  console.log('Flex UI attributes reset to defaults.');
}

export async function run(): Promise<void> {
  await validateSubscription();
  const auth = getAuth();

  if (getInput('TASKROUTER') === 'true') await resetTaskrouter(auth);
  if (getInput('SYNC') === 'true') await resetSync(auth);
  if (getInput('STUDIO') === 'true') await resetStudio(auth);
  if (getInput('SERVERLESS') === 'true') await resetServerless(auth);
  if (getInput('FLEX_CUSTOM_PLUGINS') === 'true') await disableCustomFlexPlugins(auth);
  if (getInput('FLEX_UI_ATTRIBUTES') === 'true') await resetFlexUiAttributes(auth);
}
