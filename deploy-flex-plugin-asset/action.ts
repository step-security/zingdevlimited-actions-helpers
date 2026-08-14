import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioFetch, twilioGet, twilioPost, twilioGetAllPages } from '../_lib/twilio';
import { readFileSync } from 'fs';

const SERVERLESS = 'https://serverless.twilio.com/v1';
const PLUGIN_SERVICE_NAME = 'default';

async function getOrCreateService(auth: string): Promise<any> {
  const services = await twilioGetAllPages(`${SERVERLESS}/Services`, auth, 'services');
  let service = services.find((s: any) => s.unique_name === PLUGIN_SERVICE_NAME);
  if (!service) {
    const { data } = await twilioPost(`${SERVERLESS}/Services`, auth, {
      UniqueName: PLUGIN_SERVICE_NAME,
      FriendlyName: 'Flex Plugins Default Service',
      IncludeCredentials: 'false',
    });
    service = data;
  }
  return service;
}

async function getOrCreateEnvironment(serviceSid: string, auth: string): Promise<any> {
  const envs = await twilioGetAllPages(`${SERVERLESS}/Services/${serviceSid}/Environments`, auth, 'environments');
  let env = envs.find((e: any) => e.unique_name === 'flex');
  if (!env) {
    const { data } = await twilioPost(`${SERVERLESS}/Services/${serviceSid}/Environments`, auth, {
      UniqueName: 'flex',
      DomainSuffix: 'flex',
    });
    env = data;
  }
  return env;
}

async function getOrCreateAsset(serviceSid: string, assetPath: string, auth: string): Promise<any> {
  const assets = await twilioGetAllPages(`${SERVERLESS}/Services/${serviceSid}/Assets`, auth, 'assets');
  let asset = assets.find((a: any) => a.friendly_name === assetPath);
  if (!asset) {
    const { data } = await twilioPost(`${SERVERLESS}/Services/${serviceSid}/Assets`, auth, {
      FriendlyName: assetPath,
    });
    asset = data;
  }
  return asset;
}

async function uploadAssetVersion(serviceSid: string, assetSid: string, assetPath: string, fileContent: string, auth: string): Promise<any> {
  const boundary = `boundary_${Math.random().toString(36).slice(2)}`;
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="Path"`,
    '',
    assetPath,
    `--${boundary}`,
    `Content-Disposition: form-data; name="Visibility"`,
    '',
    'public',
    `--${boundary}`,
    `Content-Disposition: form-data; name="Content"; filename="bundle.js"`,
    'Content-Type: application/javascript',
    '',
    fileContent,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await twilioFetch(
    `https://serverless-upload.twilio.com/v1/Services/${serviceSid}/Assets/${assetSid}/Versions`,
    auth,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(`Asset upload failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}

async function deployBuild(serviceSid: string, environmentSid: string, assetVersionSid: string, auth: string): Promise<any> {
  const { data: build } = await twilioPost(`${SERVERLESS}/Services/${serviceSid}/Builds`, auth, {
    AssetVersions: assetVersionSid,
  });

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const buildStatus = await twilioGet(`${SERVERLESS}/Services/${serviceSid}/Builds/${build.sid}/Status`, auth);
    if (buildStatus.status === 'complete') break;
    if (buildStatus.status === 'failed') throw new Error('Twilio Serverless build failed');
  }

  const { data: deployment } = await twilioPost(
    `${SERVERLESS}/Services/${serviceSid}/Environments/${environmentSid}/Deployments`,
    auth,
    { BuildSid: build.sid }
  );

  return deployment;
}

export async function run(): Promise<void> {
  await validateSubscription();

  const filePath = getInput('FILE_PATH', true);
  const pluginName = getInput('PLUGIN_NAME', true);
  const pluginVersion = getInput('PLUGIN_VERSION', true);
  const allowOverwrite = getInput('ALLOW_VERSION_OVERWRITE') === 'true';
  const auth = getAuth();

  const assetPath = `/plugins/${pluginName}/${pluginVersion}/bundle.js`;
  const fileContent = readFileSync(filePath, 'utf8');

  const service = await getOrCreateService(auth);
  const environment = await getOrCreateEnvironment(service.sid, auth);

  const existingAssets = await twilioGetAllPages(
    `${SERVERLESS}/Services/${service.sid}/Assets`,
    auth,
    'assets'
  );
  const existingAsset = existingAssets.find((a: any) => a.friendly_name === assetPath);

  if (existingAsset && !allowOverwrite) {
    const versions = await twilioGetAllPages(
      `${SERVERLESS}/Services/${service.sid}/Assets/${existingAsset.sid}/Versions`,
      auth,
      'asset_versions'
    );
    if (versions.length > 0) {
      const env = await twilioGet(
        `${SERVERLESS}/Services/${service.sid}/Environments/${environment.sid}`,
        auth
      );
      const assetUrl = `https://${env.domain_name}${assetPath}`;
      console.log(`Asset already exists at: ${assetUrl}`);
      setOutput('ASSET_URL', assetUrl);
      setOutput('DEPLOY_SID', versions[0].sid);
      return;
    }
  }

  const asset = await getOrCreateAsset(service.sid, assetPath, auth);
  const assetVersion = await uploadAssetVersion(service.sid, asset.sid, assetPath, fileContent, auth);
  const deployment = await deployBuild(service.sid, environment.sid, assetVersion.sid, auth);

  const env = await twilioGet(
    `${SERVERLESS}/Services/${service.sid}/Environments/${environment.sid}`,
    auth
  );
  const assetUrl = `https://${env.domain_name}${assetPath}`;

  console.log(`Deployed plugin asset to: ${assetUrl}`);
  setOutput('ASSET_URL', assetUrl);
  setOutput('DEPLOY_SID', deployment.sid);
}
