import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioGet, twilioGetAllPages } from '../_lib/twilio';

const SERVERLESS = 'https://serverless.twilio.com/v1';

export async function run(): Promise<void> {
  await validateSubscription();

  const serviceName = getInput('SERVICE_NAME', true);
  const envSuffix = getInput('ENVIRONMENT_SUFFIX');
  const ignoreNotFound = getInput('IGNORE_NOT_FOUND') === 'true';
  const isPattern = getInput('IS_PATTERN') === 'true';
  const auth = getAuth();

  const services = await twilioGetAllPages(`${SERVERLESS}/Services`, auth, 'services');

  let service: any;
  if (isPattern) {
    service = services.find((s: any) => s.unique_name.includes(serviceName));
  } else {
    service = services.find((s: any) => s.unique_name === serviceName);
  }

  if (!service) {
    // A pattern that matches nothing points at a service that was never
    // installed, so it always fails rather than returning empty outputs.
    if (ignoreNotFound && !isPattern) {
      console.log(`Service '${serviceName}' not found. Returning empty outputs.`);
      setOutput('BASE_URL', '');
      setOutput('SERVICE_SID', '');
      setOutput('ENVIRONMENT_SID', '');
      setOutput('BUILD_SID', '');
      setOutput('RESOLVED_SERVICE_NAME', '');
      return;
    }
    console.error(`::error::Twilio Functions Service '${serviceName}' not found.`);
    process.exit(1);
  }

  const environments = await twilioGetAllPages(
    `${SERVERLESS}/Services/${service.sid}/Environments`,
    auth,
    'environments'
  );

  let environment: any;
  if (envSuffix) {
    environment = environments.find((e: any) => e.domain_suffix === envSuffix);
  } else {
    environment = environments[0];
  }

  if (!environment) {
    console.error(`::error::No environment found for service '${service.unique_name}'`);
    process.exit(1);
  }

  let buildSid = '';
  try {
    const buildData = await twilioGet(
      `${SERVERLESS}/Services/${service.sid}/Environments/${environment.sid}/Deployments`,
      auth
    );
    buildSid = buildData.deployments?.[0]?.build_sid ?? '';
  } catch {
    // No deployments yet
  }

  setOutput('BASE_URL', `https://${environment.domain_name}`);
  setOutput('SERVICE_SID', service.sid);
  setOutput('ENVIRONMENT_SID', environment.sid);
  setOutput('BUILD_SID', buildSid);
  setOutput('RESOLVED_SERVICE_NAME', service.unique_name);
}
