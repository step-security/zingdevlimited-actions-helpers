import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioPost, twilioGetAllPages } from '../_lib/twilio';
import { readFileSync } from 'fs';

const TR = 'https://taskrouter.twilio.com/v1';

function findBySid(list: any[], ref: any): any {
  if (!ref) return undefined;
  return list.find((i: any) => i.sid === ref.sid || i.friendly_name?.toLowerCase() === ref.friendlyName?.toLowerCase());
}

/** Structural comparison that ignores key ordering. */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => key in b && deepEqual(a[key], b[key]));
}

/**
 * Compares only the fields the config actually specifies, so leaving a property
 * out of the config never counts as a difference. Scalars are compared as
 * strings because the Twilio API echoes numbers and booleans back as text.
 */
function matchesDesiredState(current: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  return Object.entries(desired).every(([key, wanted]) => {
    if (wanted === undefined) return true;
    const actual = current[key];
    if (wanted !== null && typeof wanted === 'object') return deepEqual(actual, wanted);
    return String(actual ?? '') === String(wanted);
  });
}

export async function run(): Promise<void> {
  await validateSubscription();

  const configPath = getInput('CONFIG_PATH', true);
  const workspaceName = getInput('WORKSPACE_NAME');
  const workspaceCallbackUrl = getInput('WORKSPACE_CALLBACK_URL');
  const auth = getAuth();

  const configFile = JSON.parse(readFileSync(configPath, 'utf8'));

  const workspaceList = await twilioGetAllPages(`${TR}/Workspaces`, auth, 'workspaces');
  if (!workspaceList.length) throw new Error('No Taskrouter Workspaces found');

  let workspaceSid: string;
  const trimmedName = workspaceName?.trim();
  if (!trimmedName) {
    workspaceSid = workspaceList[0].sid;
  } else {
    const existing = workspaceList.find((w: any) => w.friendly_name?.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      workspaceSid = existing.sid;
    } else {
      const { data } = await twilioPost(`${TR}/Workspaces`, auth, { FriendlyName: trimmedName });
      workspaceSid = data.sid;
    }
  }

  const wsUrl = `${TR}/Workspaces/${workspaceSid}`;
  const results: any = { activities: {}, channels: {}, queues: {}, workflows: {}, workspace: {} };

  const activityList = await twilioGetAllPages(`${wsUrl}/Activities`, auth, 'activities');
  for (const activity of configFile.activities ?? []) {
    const existing = activityList.find((a: any) => a.friendly_name?.toLowerCase() === activity.friendlyName.toLowerCase());
    if (!existing) {
      const { data } = await twilioPost(`${wsUrl}/Activities`, auth, {
        FriendlyName: activity.friendlyName, Available: activity.available.toString(),
      });
      console.log(`Activity ${activity.friendlyName} ${data.sid}`);
      results.activities[activity.friendlyName] = data;
      activityList.push(data);
    } else {
      console.log(`(Unchanged) Activity ${activity.friendlyName} ${existing.sid}`);
      results.activities[activity.friendlyName] = existing;
    }
  }

  if (configFile.workspace || workspaceCallbackUrl) {
    const ws = configFile.workspace ?? {};
    const defaultActivity = findBySid(activityList, ws.defaultActivity);
    const timeoutActivity = findBySid(activityList, ws.timeoutActivity);
    const postBody: Record<string, string> = {};
    if (defaultActivity) postBody.DefaultActivitySid = defaultActivity.sid;
    if (timeoutActivity) postBody.TimeoutActivitySid = timeoutActivity.sid;
    if (ws.eventCallbackUrl !== undefined) postBody.EventCallbackUrl = ws.eventCallbackUrl;
    else if (workspaceCallbackUrl) postBody.EventCallbackUrl = workspaceCallbackUrl;
    if (ws.eventsFilter) postBody.EventsFilter = ws.eventsFilter.join(',');
    if (ws.prioritizeQueueOrder) postBody.PrioritizeQueueOrder = ws.prioritizeQueueOrder;
    const { data } = await twilioPost(wsUrl, auth, postBody);
    results.workspace = data;
  }

  const channelList = await twilioGetAllPages(`${wsUrl}/TaskChannels`, auth, 'channels');
  for (const channel of configFile.channels ?? []) {
    const existing = channelList.find((c: any) => c.unique_name?.toLowerCase() === channel.uniqueName.toLowerCase());

    if (existing && matchesDesiredState(
      { friendly_name: existing.friendly_name, channel_optimized_routing: existing.channel_optimized_routing },
      { friendly_name: channel.friendlyName, channel_optimized_routing: channel.channelOptimizedRouting },
    )) {
      console.log(`(Unchanged) TaskChannel ${channel.uniqueName} ${existing.sid}`);
      results.channels[channel.uniqueName] = existing;
      continue;
    }

    const postBody: Record<string, string> = { FriendlyName: channel.friendlyName };
    if (channel.channelOptimizedRouting !== undefined) postBody.ChannelOptimizedRouting = channel.channelOptimizedRouting.toString();
    const url = existing ? `${wsUrl}/TaskChannels/${existing.sid}` : `${wsUrl}/TaskChannels`;
    if (!existing) postBody.UniqueName = channel.uniqueName;
    const { data } = await twilioPost(url, auth, postBody);
    console.log(`TaskChannel ${channel.uniqueName} ${data.sid}`);
    results.channels[channel.uniqueName] = data;
    if (!existing) channelList.push(data);
  }

  const queueList = await twilioGetAllPages(`${wsUrl}/TaskQueues?PageSize=1000`, auth, 'task_queues');
  for (const queue of configFile.queues ?? []) {
    const existing = queueList.find((q: any) => q.friendly_name?.toLowerCase() === queue.friendlyName.toLowerCase());
    const assignActivity = findBySid(activityList, queue.assignmentActivity);
    const reserveActivity = findBySid(activityList, queue.reservationActivity);

    if (existing && matchesDesiredState(
      {
        target_workers: existing.target_workers,
        max_reserved_workers: existing.max_reserved_workers,
        task_order: existing.task_order,
        assignment_activity_sid: existing.assignment_activity_sid,
        reservation_activity_sid: existing.reservation_activity_sid,
      },
      {
        target_workers: queue.targetWorkers,
        max_reserved_workers: queue.maxReservedWorkers,
        task_order: queue.taskOrder,
        assignment_activity_sid: assignActivity?.sid,
        reservation_activity_sid: reserveActivity?.sid,
      },
    )) {
      console.log(`(Unchanged) TaskQueue ${queue.friendlyName} ${existing.sid}`);
      results.queues[queue.friendlyName] = existing;
      continue;
    }

    const postBody: Record<string, string> = { FriendlyName: queue.friendlyName };
    if (queue.targetWorkers) postBody.TargetWorkers = queue.targetWorkers;
    if (queue.maxReservedWorkers) postBody.MaxReservedWorkers = queue.maxReservedWorkers.toString();
    if (queue.taskOrder) postBody.TaskOrder = queue.taskOrder;
    if (assignActivity) postBody.AssignmentActivitySid = assignActivity.sid;
    if (reserveActivity) postBody.ReservationActivitySid = reserveActivity.sid;
    const url = existing ? `${wsUrl}/TaskQueues/${existing.sid}` : `${wsUrl}/TaskQueues`;
    const { data } = await twilioPost(url, auth, postBody);
    console.log(`TaskQueue ${queue.friendlyName} ${data.sid}`);
    results.queues[queue.friendlyName] = data;
    if (!existing) queueList.push(data);
  }

  const workflowList = await twilioGetAllPages(`${wsUrl}/Workflows`, auth, 'workflows');
  for (const workflow of configFile.workflows ?? []) {
    const config = JSON.parse(JSON.stringify(workflow.configuration));
    if (config.task_routing?.default_filter) {
      const q = findBySid(queueList, config.task_routing.default_filter.queue);
      if (q) config.task_routing.default_filter.queue = q.sid;
    }
    for (const filter of config.task_routing?.filters ?? []) {
      for (const target of filter.targets ?? []) {
        const q = findBySid(queueList, target.queue);
        if (q) target.queue = q.sid;
      }
    }
    const existing = workflowList.find((w: any) => w.friendly_name?.toLowerCase() === workflow.friendlyName.toLowerCase());

    if (existing && matchesDesiredState(
      {
        assignment_callback_url: existing.assignment_callback_url,
        fallback_assignment_callback_url: existing.fallback_assignment_callback_url,
        task_reservation_timeout: existing.task_reservation_timeout,
        configuration: JSON.parse(existing.configuration ?? 'null'),
      },
      {
        assignment_callback_url: workflow.assignmentCallbackUrl,
        fallback_assignment_callback_url: workflow.fallbackAssignmentCallbackUrl,
        task_reservation_timeout: workflow.taskReservationTimeout,
        configuration: config,
      },
    )) {
      console.log(`(Unchanged) Workflow ${workflow.friendlyName} ${existing.sid}`);
      results.workflows[workflow.friendlyName] = existing;
      continue;
    }

    const postBody: Record<string, string> = {
      FriendlyName: workflow.friendlyName,
      Configuration: JSON.stringify(config),
    };
    if (workflow.assignmentCallbackUrl !== undefined) postBody.AssignmentCallbackUrl = workflow.assignmentCallbackUrl;
    if (workflow.fallbackAssignmentCallbackUrl !== undefined) postBody.FallbackAssignmentCallbackUrl = workflow.fallbackAssignmentCallbackUrl;
    if (workflow.taskReservationTimeout) postBody.TaskReservationTimeout = workflow.taskReservationTimeout.toString();
    const url = existing ? `${wsUrl}/Workflows/${existing.sid}` : `${wsUrl}/Workflows`;
    const { data } = await twilioPost(url, auth, postBody);
    console.log(`Workflow ${workflow.friendlyName} ${data.sid}`);
    results.workflows[workflow.friendlyName] = data;
    if (!existing) workflowList.push(data);
  }

  setOutput('RESOURCES', JSON.stringify(results));
  setOutput('WORKSPACE_SID', workspaceSid);
}
