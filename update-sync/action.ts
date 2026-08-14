import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioGet, twilioPost, twilioGetAllPages } from '../_lib/twilio';
import { readFileSync } from 'fs';

const SYNC = 'https://sync.twilio.com/v1';

async function getOrCreateResource(serviceBase: string, type: string, uniqueName: string, createParams: Record<string, string>, auth: string): Promise<any> {
  const listRes = await twilioGet(`${serviceBase}/${type}`, auth);
  const listKey = Object.keys(listRes).find((k: string) => Array.isArray(listRes[k]) && k !== 'meta');
  const items = listRes[listKey!] ?? [];
  const existing = items.find((i: any) => i.unique_name === uniqueName);
  if (existing) return existing;

  const params = { UniqueName: uniqueName, ...createParams };
  const created = await twilioPost(`${serviceBase}/${type}`, auth, params);
  console.log(`Created Sync ${type} '${uniqueName}'`);
  return created.data;
}

async function setPermission(serviceBase: string, type: string, uniqueName: string, permId: string, auth: string): Promise<void> {
  const permMap: Record<string, Record<string, string>> = {
    READ_ONLY: { Read: 'true', Write: 'false', Manage: 'false' },
    WRITE_ONLY: { Read: 'false', Write: 'true', Manage: 'false' },
    READ_WRITE: { Read: 'true', Write: 'true', Manage: 'false' },
  };
  const perm = permMap[permId] ?? { Read: 'false', Write: 'false', Manage: 'false' };
  await twilioPost(`${serviceBase}/${type}/${uniqueName}/Permissions/${permId}`, auth, perm);
}

async function createSyncMapItemsIfNotExists(serviceBase: string, mapName: string, items: any[], auth: string): Promise<void> {
  const res = await twilioGet(`${serviceBase}/Maps/${mapName}/Items`, auth);
  const existing = res.items ?? [];
  for (const { key, data } of items) {
    if (!existing.some((i: any) => i.key === key)) {
      await twilioPost(`${serviceBase}/Maps/${mapName}/Items`, auth, { Key: key, Data: JSON.stringify(data) });
      console.log(`Created SyncMap item '${key}' in '${mapName}'`);
    }
  }
}

export async function run(): Promise<void> {
  await validateSubscription();

  const configPath = getInput('CONFIG_PATH', true);
  const serviceName = getInput('SERVICE_NAME');
  const aclEnabled = getInput('SERVICE_ACL_ENABLED') === 'true';
  const auth = getAuth();

  const configFile = JSON.parse(readFileSync(configPath, 'utf8'));

  let syncServiceSid: string;
  if (serviceName) {
    const services = await twilioGetAllPages(`${SYNC}/Services`, auth, 'services');
    let service = services.find((s: any) => s.friendly_name?.toLowerCase() === serviceName.toLowerCase());
    if (!service) {
      const { data } = await twilioPost(`${SYNC}/Services`, auth, {
        FriendlyName: serviceName, AclEnabled: aclEnabled.toString(),
      });
      service = data;
      console.log(`Created Sync Service '${serviceName}' (ACL: ${aclEnabled})`);
    }
    syncServiceSid = service.sid;
  } else {
    syncServiceSid = 'default';
  }

  setOutput('SYNC_SERVICE_SID', syncServiceSid);

  const serviceBase = `${SYNC}/Services/${syncServiceSid}`;

  for (const doc of configFile.documents ?? []) {
    const resource = await getOrCreateResource(serviceBase, 'Documents', doc.uniqueName, { Data: JSON.stringify(doc.defaultData) }, auth);
    for (const permId of doc.aclPermissions ?? []) {
      await setPermission(serviceBase, 'Documents', resource.unique_name, permId, auth);
    }
  }

  for (const list of configFile.lists ?? []) {
    const resource = await getOrCreateResource(serviceBase, 'Lists', list.uniqueName, {}, auth);
    for (const permId of list.aclPermissions ?? []) {
      await setPermission(serviceBase, 'Lists', resource.unique_name, permId, auth);
    }
  }

  for (const map of configFile.maps ?? []) {
    const resource = await getOrCreateResource(serviceBase, 'Maps', map.uniqueName, {}, auth);
    for (const permId of map.aclPermissions ?? []) {
      await setPermission(serviceBase, 'Maps', resource.unique_name, permId, auth);
    }
    if (map.defaultItems?.length) {
      await createSyncMapItemsIfNotExists(serviceBase, map.uniqueName, map.defaultItems, auth);
    }
  }

  for (const stream of configFile.streams ?? []) {
    await getOrCreateResource(serviceBase, 'Streams', stream.uniqueName, {}, auth);
  }
}
