import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioGetAllPages } from '../_lib/twilio';

const TASKROUTER_AREA = 'taskrouter';

/**
 * Taskrouter nests almost everything under a Workspace, so the Workspace has to
 * be resolved before the real list URL can be built. Accounts are assumed to
 * have a single Workspace, matching how Flex provisions them.
 */
async function resolveTaskrouterUrl(version: string, apiType: string, auth: string): Promise<{ url?: string; sid?: string }> {
  const workspaces = await twilioGetAllPages(`https://taskrouter.twilio.com/${version}/Workspaces`, auth, 'workspaces');
  if (!workspaces.length) throw new Error('No Taskrouter Workspaces found in this account');

  const workspaceSid = workspaces[0].sid;
  // Asking for the Workspace itself needs no further lookup.
  if (apiType === 'Workspaces' || apiType === 'Workspace') return { sid: workspaceSid };

  return { url: `https://taskrouter.twilio.com/${version}/Workspaces/${workspaceSid}/${apiType}` };
}

export async function run(): Promise<void> {
  await validateSubscription();

  const area = getInput('TWILIO_AREA', true);
  const apiType = getInput('API_TYPE', true);
  const searchBy = getInput('SEARCH_BY');
  const searchValue = getInput('SEARCH_VALUE');
  const version = getInput('VERSION') || 'v1';
  const allowNoResults = getInput('ALLOW_NO_RESULTS') === 'true';
  const auth = getAuth();

  let listUrl = `https://${area}.twilio.com/${version}/${apiType}`;
  if (area === TASKROUTER_AREA) {
    const resolved = await resolveTaskrouterUrl(version, apiType, auth);
    if (resolved.sid) {
      console.log(`Found resource SID: ${resolved.sid}`);
      setOutput('SID', resolved.sid);
      return;
    }
    listUrl = resolved.url as string;
  }

  const resources = await twilioGetAllPages(listUrl, auth);

  const criteria = searchBy ? `${searchBy} '${searchValue}'` : 'any';
  const matches = searchBy ? resources.filter((r: any) => r[searchBy] === searchValue) : resources;

  if (!matches.length) {
    if (allowNoResults) {
      console.log(`No ${area} ${apiType} matched ${criteria}. Returning an empty SID.`);
      setOutput('SID', '');
      return;
    }
    console.error(`::error::No ${area} ${apiType} matched ${criteria}`);
    process.exit(1);
  }

  // An ambiguous result means the caller's search would silently pick one of
  // several resources, so refuse rather than guess.
  if (searchBy && matches.length > 1) {
    console.error(`::error::${matches.length} ${area} ${apiType} resources matched ${criteria}; expected exactly one`);
    process.exit(1);
  }

  console.log(`Found resource SID: ${matches[0].sid}`);
  setOutput('SID', matches[0].sid);
}
