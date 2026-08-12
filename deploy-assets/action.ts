import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioFetch } from '../_lib/twilio';
import { readFileSync, readdirSync, existsSync, statSync, appendFileSync } from 'fs';
import path from 'path';

const SERVERLESS = 'https://serverless.twilio.com/v1/Services';
const UPLOAD = 'https://serverless-upload.twilio.com/v1/Services';

function getMimeType(ext: string | undefined): string {
  const types: Record<string, string> = {
    js: 'application/javascript', mjs: 'application/javascript',
    json: 'application/json', html: 'text/html', htm: 'text/html',
    css: 'text/css', txt: 'text/plain', xml: 'text/xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
    pdf: 'application/pdf', zip: 'application/zip',
    map: 'application/json',
  };
  return types[ext?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/**
 * Serverless calls here span form-encoded posts, multipart uploads and empty
 * DELETE responses, so this wraps the shared retrying fetch rather than the
 * narrower helpers in _lib.
 */
async function twilioRequest(url: string, method: string, body: any, auth: string): Promise<any> {
  const headers: Record<string, string> = {};
  let reqBody: FormData | string | undefined;
  if (body instanceof FormData) {
    reqBody = body;
  } else if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    reqBody = new URLSearchParams(body).toString();
  }
  const res = await twilioFetch(url, auth, { method, headers, body: reqBody });
  if (!res.ok) throw new Error(`${method} ${url} failed (${res.status}): ${await res.text()}`);
  if (res.status === 204) return {};
  return res.json();
}

async function getOrCreateService(name: string, uiEditable: string | null, auth: string): Promise<string> {
  try {
    const svc = await twilioRequest(`${SERVERLESS}/${name}`, 'GET', null, auth);
    if (uiEditable !== null && svc.ui_editable?.toString() !== uiEditable) {
      await twilioRequest(`${SERVERLESS}/${svc.sid}`, 'POST', { UiEditable: uiEditable }, auth);
    }
    return svc.sid;
  } catch (e: any) {
    if (!e.message.includes('(404)')) throw e;
    const svc = await twilioRequest(`${SERVERLESS}`, 'POST', {
      UniqueName: name, FriendlyName: name,
      IncludeCredentials: 'false', UiEditable: (uiEditable === 'true').toString(),
    }, auth);
    console.log(`Created Serverless Service '${name}' (${svc.sid})`);
    return svc.sid;
  }
}

async function getOrCreateEnvironment(serviceSid: string, envName: string, envSuffix: string | null, auth: string): Promise<any> {
  const res = await twilioRequest(`${SERVERLESS}/${serviceSid}/Environments`, 'GET', null, auth);
  const targetSuffix = envSuffix ?? null;
  let env = res.environments.find((e: any) => e.domain_suffix === targetSuffix);
  if (!env) {
    const params: Record<string, string> = { UniqueName: envName };
    if (envSuffix) params.DomainSuffix = envSuffix;
    env = await twilioRequest(`${SERVERLESS}/${serviceSid}/Environments`, 'POST', params, auth);
    console.log(`Created Environment '${envName}' (${env.sid})`);
  }
  return env;
}

async function getOrCreateAsset(serviceSid: string, friendlyName: string, existingAssets: any[], auth: string): Promise<string> {
  const existing = existingAssets.find((a: any) => a.friendly_name === friendlyName);
  if (existing) return existing.sid;
  const asset = await twilioRequest(`${SERVERLESS}/${serviceSid}/Assets`, 'POST', { FriendlyName: friendlyName }, auth);
  console.log(`Created Asset '${friendlyName}' (${asset.sid})`);
  return asset.sid;
}

async function uploadAssetVersion(serviceSid: string, assetSid: string, assetPath: string, content: Buffer, mimeType: string, visibility: string, auth: string): Promise<any> {
  const formData = new FormData();
  formData.set('Path', assetPath);
  formData.set('Visibility', visibility);
  formData.set('Content', new Blob([content], { type: mimeType }), path.basename(assetPath));
  const res = await twilioFetch(`${UPLOAD}/${serviceSid}/Assets/${assetSid}/Versions`, auth, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function run(): Promise<void> {
  await validateSubscription();

  const serviceName = getInput('SERVICE_NAME', true);
  const envNameInput = getInput('ENVIRONMENT_NAME');
  const envSuffixInput = getInput('ENVIRONMENT_SUFFIX');
  const replaceMarkersExt = getInput('REPLACE_MARKERS_IN_EXT');
  const assetsDir = getInput('ASSETS_DIRECTORY', true);
  const uiEditable = getInput('UI_EDITABLE') || null;
  const preserveExisting = getInput('PRESERVE_EXISTING') === 'true';
  const pollTimeout = Math.min(parseInt(getInput('BUILD_POLL_TIMEOUT_SECONDS') || '50', 10), 300);
  const pollInterval = Math.min(parseInt(getInput('BUILD_POLL_INTERVAL_SECONDS') || '5', 10), 60);
  const auth = getAuth();

  if (!existsSync(assetsDir)) throw new Error(`Path '${assetsDir}' does not exist`);
  if (!statSync(assetsDir).isDirectory()) throw new Error(`Path '${assetsDir}' is not a directory`);

  const environmentName = envNameInput || envSuffixInput || 'production';
  const environmentSuffix = envSuffixInput?.toLowerCase() || envNameInput?.toLowerCase() || null;
  const markerExt = replaceMarkersExt ? replaceMarkersExt.replace(/\./g, '').toLowerCase().split(',') : [];

  const serviceSid = await getOrCreateService(serviceName, uiEditable, auth);
  const environment = await getOrCreateEnvironment(serviceSid, environmentName, environmentSuffix, auth);

  const assetListRes = await twilioRequest(`${SERVERLESS}/${serviceSid}/Assets`, 'GET', null, auth);
  const existingAssets = assetListRes.assets;

  const files = readdirSync(assetsDir, { recursive: true, withFileTypes: true })
    .filter((d: any) => d.isFile())
    .map((d: any) => path.relative(assetsDir, path.join(d.parentPath, d.name)));

  if (!files.length) throw new Error(`No files found in '${assetsDir}'`);

  const buildParams = new URLSearchParams();
  const updatedPaths = new Set<string>();

  if (preserveExisting && environment.build_sid) {
    const buildRes = await twilioRequest(`${SERVERLESS}/${serviceSid}/Builds/${environment.build_sid}`, 'GET', null, auth);
    for (const av of buildRes.asset_versions ?? []) {
      updatedPaths.add(av.path);
      buildParams.append('AssetVersions', av.sid);
    }
    for (const fv of buildRes.function_versions ?? []) buildParams.append('FunctionVersions', fv.sid);
    const deps = buildRes.dependencies;
    if (Array.isArray(deps) && deps.length) buildParams.append('Dependencies', JSON.stringify(deps));
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(summary, `## Deployed Assets to ${serviceName} ${environmentName}\n\n| Path | Type | Visibility |\n| --- | --- | --- |\n`);
  }

  for (const file of files) {
    let assetPath = `/${file.replace(/\\/g, '/')}`;
    let visibility = 'public';
    if (assetPath.includes('.private')) { visibility = 'private'; assetPath = assetPath.replace('.private', ''); }
    else if (assetPath.includes('.protected')) { visibility = 'protected'; assetPath = assetPath.replace('.protected', ''); }

    const ext = assetPath.split('.').at(-1);
    const mimeType = getMimeType(ext);

    let content = readFileSync(`${assetsDir}/${file}`);
    if (markerExt.includes(ext?.toLowerCase() ?? '')) {
      let str = content.toString('utf8');
      str = str.replaceAll('{{DOMAIN}}', `https://${environment.domain_name}`);
      content = Buffer.from(str, 'utf8');
    }

    const assetSid = await getOrCreateAsset(serviceSid, assetPath, existingAssets, auth);

    if (preserveExisting && updatedPaths.has(assetPath)) {
      for (const [key, val] of buildParams.entries()) {
        if (key === 'AssetVersions') {
          const existing = existingAssets.find((a: any) => a.friendly_name === assetPath);
          if (existing?.sid === val) { buildParams.delete('AssetVersions'); break; }
        }
      }
    }

    const version = await uploadAssetVersion(serviceSid, assetSid, assetPath, content, mimeType, visibility, auth);
    console.log(`Uploaded ${visibility} '${assetPath}' (${version.sid})`);
    buildParams.append('AssetVersions', version.sid);
    if (summary) appendFileSync(summary, `| ${assetPath} | ${mimeType} | ${visibility} |\n`);
  }

  const build = await twilioRequest(`${SERVERLESS}/${serviceSid}/Builds`, 'POST', buildParams, auth);
  console.log(`Starting build ${build.sid}...`);

  const maxPolls = Math.ceil(pollTimeout / pollInterval);
  let buildStatus = 'building';
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollInterval * 1000));
    const statusRes = await twilioRequest(`${SERVERLESS}/${serviceSid}/Builds/${build.sid}/Status`, 'GET', null, auth);
    buildStatus = statusRes.status;
    console.log(`[${(i + 1) * pollInterval}s] Build status: ${buildStatus}`);
    if (buildStatus === 'completed') break;
    if (buildStatus === 'failed') throw new Error(`Build ${build.sid} failed`);
  }
  if (buildStatus !== 'completed') throw new Error(`Build ${build.sid} timed out after ${pollTimeout}s`);

  const deployment = await twilioRequest(
    `${SERVERLESS}/${serviceSid}/Environments/${environment.sid}/Deployments`,
    'POST', { BuildSid: build.sid }, auth
  );
  console.log(`Deployed to environment ${environment.sid} (${deployment.sid})`);
}
