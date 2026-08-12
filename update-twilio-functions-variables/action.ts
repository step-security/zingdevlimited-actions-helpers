import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPost, twilioDelete, twilioGetAllPages } from '../_lib/twilio';
import { appendFileSync } from 'fs';

const SERVERLESS = 'https://serverless.twilio.com/v1/Services';

export async function run(): Promise<void> {
  await validateSubscription();

  const serviceName = getInput('SERVICE_NAME', true);
  const environmentSuffix = getInput('ENVIRONMENT_SUFFIX');
  const variablesEnv = getInput('VARIABLES_ENV', true);
  const optionalVarsRaw = getInput('OPTIONAL_VARIABLES');
  const auth = getAuth();

  const optionalVars = optionalVarsRaw ? optionalVarsRaw.replace(/\s/g, '').split(',').filter(Boolean) : [];

  const variablesToSet: Record<string, string> = {};
  const missingVariables: string[] = [];
  for (const [i, line] of variablesEnv.split('\n').entries()) {
    if (!line?.trim()) continue;
    const eq = line.indexOf('=');
    if (eq < 0) throw new Error(`Invalid assignment on line ${i + 1}: '=' not found`);
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (value) {
      variablesToSet[key] = value;
    } else if (!optionalVars.includes(key)) {
      missingVariables.push(key);
    }
  }
  if (missingVariables.length) throw new Error(`Empty value for required variables: ${missingVariables.join(', ')}`);

  const service = await twilioGet(`${SERVERLESS}/${serviceName}`, auth);
  const serviceSid = service.sid;
  console.log(`Service: ${serviceName} (${serviceSid})`);

  const envListRes = await twilioGet(`${SERVERLESS}/${serviceSid}/Environments`, auth);
  const targetSuffix = environmentSuffix || null;
  const environment = (envListRes.environments ?? []).find((e: any) => e.domain_suffix === targetSuffix);
  if (!environment) throw new Error(`Environment with suffix '${targetSuffix}' not found`);
  const environmentSid = environment.sid;
  console.log(`Environment: ${environmentSid}`);

  const varsRes = await twilioGetAllPages(`${SERVERLESS}/${serviceSid}/Environments/${environmentSid}/Variables`, auth, 'variables');
  const currentVars: Record<string, { sid: string; value: string }> = {};
  for (const v of varsRes) currentVars[v.key] = { sid: v.sid, value: v.value };

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `## Updated Variables for ${serviceName} ${environmentSuffix || 'production'}\n`);

  const varsBase = `${SERVERLESS}/${serviceSid}/Environments/${environmentSid}/Variables`;
  for (const [variable, value] of Object.entries(variablesToSet)) {
    let outcome: string;
    if (currentVars[variable]) {
      if (currentVars[variable].value === value) {
        console.log(`Variable '${variable}' unchanged`);
        outcome = 'unchanged';
      } else {
        await twilioPost(`${varsBase}/${currentVars[variable].sid}`, auth, { Key: variable, Value: value });
        console.log(`Updated '${variable}'`);
        outcome = 'updated';
      }
    } else {
      await twilioPost(varsBase, auth, { Key: variable, Value: value });
      console.log(`Created '${variable}'`);
      outcome = 'created';
    }
    if (summary) appendFileSync(summary, `- ${variable}: \`${outcome}\`\n`);
  }

  const toDelete = Object.entries(currentVars).filter(([k]) => !variablesToSet[k] && !optionalVars.includes(k));
  for (const [key, { sid }] of toDelete) {
    try {
      await twilioDelete(`${varsBase}/${sid}`, auth);
      console.log(`Deleted '${key}'`);
      if (summary) appendFileSync(summary, `- ~~${key}~~: \`deleted\`\n`);
    } catch (e: any) {
      if (!e.message.includes('(404)')) throw e;
    }
  }
}
