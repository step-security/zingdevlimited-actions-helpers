import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioPost, twilioGetAllPages } from '../_lib/twilio';

const FLEX_API = 'https://flex-api.twilio.com/v1/PluginService';

async function findPlugin(name: string, auth: string): Promise<any> {
  const plugins = await twilioGetAllPages(`${FLEX_API}/Plugins`, auth, 'plugins');
  return plugins.find((p: any) => p.unique_name === name);
}

async function findExistingVersion(pluginSid: string, version: string, auth: string): Promise<any> {
  const versions = await twilioGetAllPages(`${FLEX_API}/Plugins/${pluginSid}/Versions`, auth, 'plugin_versions');
  return versions.find((v: any) => v.version === version);
}

export async function run(): Promise<void> {
  await validateSubscription();

  const pluginName = getInput('PLUGIN_NAME', true);
  const pluginVersion = getInput('PLUGIN_VERSION', true);
  const assetUrl = getInput('ASSET_URL', true);
  const auth = getAuth();

  const plugin = await findPlugin(pluginName, auth);
  if (!plugin) {
    console.error(`::error::Plugin '${pluginName}' not found in Twilio Flex.`);
    process.exit(1);
  }

  const existing = await findExistingVersion(plugin.sid, pluginVersion, auth);
  if (existing) {
    console.log(`Plugin version ${pluginVersion} already exists with SID: ${existing.sid}`);
    setOutput('PLUGIN_VERSION_SID', existing.sid);
    return;
  }

  const { data } = await twilioPost(
    `${FLEX_API}/Plugins/${plugin.sid}/Versions`,
    auth,
    { Version: pluginVersion, PluginUrl: assetUrl, Private: 'false' }
  );

  console.log(`Created plugin version ${pluginVersion} with SID: ${data.sid}`);
  setOutput('PLUGIN_VERSION_SID', data.sid);
}
