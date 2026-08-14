import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPostJson } from '../_lib/twilio';

const FLEX = 'https://flex-api.twilio.com/v1';

export async function run(): Promise<void> {
  await validateSubscription();

  const flexUiVersion = getInput('FLEX_UI_VERSION', true);
  const pluginName = getInput('PLUGIN_NAME', true);
  const versionSid = getInput('VERSION_SID', true);
  const auth = getAuth();

  const libraryUrl = `${FLEX}/PluginService/Library`;

  const pluginInfo = await twilioGet(
    `${libraryUrl}/Plugins/${pluginName}?UiVersion=${encodeURIComponent(flexUiVersion)}`,
    auth
  );

  if (pluginInfo.installed_version?.sid === versionSid) {
    console.log(`Plugin '${pluginInfo.friendly_name}' version ${pluginInfo.installed_version.version} already installed.`);
    return;
  }

  const attributes = Object.entries(process.env)
    .filter(([k]) => k.startsWith('ATTRIBUTE_'))
    .map(([k, v]) => ({ name: k.slice('ATTRIBUTE_'.length), value: v }));

  const installRes = await twilioPostJson(
    `${libraryUrl}/Plugins/${pluginInfo.sid}/Install`,
    auth,
    { plugin_sid: pluginInfo.sid, plugin_version_sid: versionSid, attributes }
  );
  const taskSid = installRes.data.sid;

  const POLL_INTERVAL_MS = 10000;
  const POLL_COUNT = 30;
  console.log(`Installing plugin '${pluginInfo.friendly_name}'... (timeout: ${(POLL_INTERVAL_MS * POLL_COUNT) / 1000}s)`);

  let installStatus = 'INITIATED';
  for (let i = 1; i <= POLL_COUNT; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await twilioGet(`${libraryUrl}/Tasks/${taskSid}/Status`, auth);
    installStatus = statusRes.status;
    console.log(`[${i * POLL_INTERVAL_MS / 1000}s] Install status: ${installStatus}`);
    if (installStatus === 'INSTALLED') break;
    if (installStatus !== 'INSTALLING') {
      throw new Error(`Unexpected install status: '${installStatus}'`);
    }
  }

  if (installStatus !== 'INSTALLED') throw new Error(`Installation timed out after ${(POLL_INTERVAL_MS * POLL_COUNT) / 1000}s`);
  console.log('Installation complete.');
}
