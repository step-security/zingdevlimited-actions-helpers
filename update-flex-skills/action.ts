import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPostJson } from '../_lib/twilio';

const FLEX_CONFIG = 'https://flex-api.twilio.com/v1/Configuration';

export async function run(): Promise<void> {
  await validateSubscription();

  const simpleSkills = getInput('SIMPLE_SKILLS');
  const complexSkills = getInput('COMPLEX_SKILLS');
  const mode = getInput('MODE') || 'merge';
  const auth = getAuth();

  if (!simpleSkills && !complexSkills) throw new Error('Require either SIMPLE_SKILLS or COMPLEX_SKILLS input');

  const currentConfig = await twilioGet(FLEX_CONFIG, auth);
  let skillsArray: any[] = (mode === 'replace') ? [] : (currentConfig.taskrouter_skills ?? []);

  if (simpleSkills) {
    for (const line of simpleSkills.split('\n')) {
      const name = line.trim();
      if (!name) continue;
      if (!skillsArray.some((s: any) => s.name === name)) {
        skillsArray.push({ name, multivalue: false, minimum: null, maximum: null });
      }
    }
  }

  if (complexSkills) {
    const parsed = JSON.parse(complexSkills);
    if (!Array.isArray(parsed)) throw new Error('COMPLEX_SKILLS must be a JSON array');
    for (const skill of parsed) {
      if (!skillsArray.some((s: any) => s.name === skill.name)) skillsArray.push(skill);
    }
  }

  await twilioPostJson(FLEX_CONFIG, auth, {
    account_sid: currentConfig.account_sid,
    taskrouter_skills: skillsArray,
  });

  console.log(`Updated ${skillsArray.length} Flex worker skills (mode: ${mode})`);
}
