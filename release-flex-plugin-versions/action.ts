import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPost } from '../_lib/twilio';
import { appendFileSync } from 'fs';

const FLEX = 'https://flex-api.twilio.com/v1/PluginService';

export async function run(): Promise<void> {
  await validateSubscription();

  const pluginVersionsRaw = getInput('PLUGIN_VERSIONS', true);
  const releaseName = getInput('RELEASE_NAME') || `Autorelease #${process.env.GITHUB_RUN_NUMBER ?? Date.now()}`;
  const releaseDescription = getInput('RELEASE_DESCRIPTION');
  const auth = getAuth();

  const pluginVersions = pluginVersionsRaw.split('\n')
    .filter((l: string) => l?.split('=').length === 2)
    .map((l: string) => l.split('='));

  let summary = `## Flex Plugin Release\n\n**Name**: ${releaseName}\n\n`;
  if (releaseDescription) summary += `**Description**: ${releaseDescription}\n\n`;
  summary += `| Plugin | Version |\n| ----- | ----- |\n`;

  const pluginVersionSids: Record<string, string> = {};

  for (const [pluginName, pluginVer] of pluginVersions) {
    const verData = await twilioGet(`${FLEX}/Plugins/${pluginName}/Versions/${pluginVer}`, auth);
    pluginVersionSids[pluginName] = verData.sid;
    summary += `| **${pluginName}** | **${pluginVer}** |\n`;
  }

  try {
    const activeRelease = await twilioGet(`${FLEX}/Releases/Active`, auth);
    const configPlugins = await twilioGet(`${FLEX}/Configurations/${activeRelease.configuration_sid}/Plugins`, auth);
    for (const plugin of configPlugins.plugins ?? []) {
      if (!pluginVersionSids[plugin.unique_name]) {
        pluginVersionSids[plugin.unique_name] = plugin.plugin_version_sid;
        summary += `| ${plugin.unique_name} | ${plugin.version} |\n`;
      }
    }
  } catch (e: any) {
    if (!e.message.includes('(404)')) throw e;
  }

  const configParams = new URLSearchParams({ Name: releaseName });
  if (releaseDescription) configParams.append('Description', releaseDescription);
  for (const sid of Object.values(pluginVersionSids)) {
    configParams.append('Plugins', JSON.stringify({ plugin_version: sid }));
  }

  let configSid: string;
  try {
    const { data: config } = await twilioPost(`${FLEX}/Configurations`, auth, configParams);
    configSid = config.sid;
  } catch (e: any) {
    if (e.message?.includes('duplicate')) {
      console.log('::warning::Configuration is duplicate. Skipping release.');
      return;
    }
    throw e;
  }

  const { data: release } = await twilioPost(`${FLEX}/Releases`, auth, { ConfigurationId: configSid });
  summary += `\n**Configuration Sid**: ${configSid}\n\n**Release Sid**: ${release.sid}\n`;

  console.log(`Released configuration ${configSid} as release ${release.sid}`);

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) appendFileSync(stepSummary, summary);
}
