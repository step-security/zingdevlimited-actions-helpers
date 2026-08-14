import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, twilioGet, twilioPost, twilioDelete } from '../_lib/twilio';
import { readFileSync } from 'fs';

const FLEX = 'https://flex-api.twilio.com/v1';

export async function run(): Promise<void> {
  await validateSubscription();

  const configPath = getInput('CONFIG_PATH', true);
  const deleteUnused = getInput('DELETE_UNUSED') === 'true';
  const auth = getAuth();

  const { teams: requiredTeams } = JSON.parse(readFileSync(configPath, 'utf8'));

  const config = await twilioGet(`${FLEX}/Configuration`, auth);
  const instanceSid = config.flex_instance_sid;
  if (!instanceSid) throw new Error('Flex instance SID not found in configuration');

  const teamsRes = await twilioGet(`${FLEX}/Instances/${instanceSid}/Teams?PageSize=1000`, auth);
  const fetchedTeams: any[] = [...(teamsRes.teams ?? [])];

  if (deleteUnused) {
    for (const level of [1, 2, 3]) {
      const atLevel = fetchedTeams.filter((t: any) => t.level === level);
      const requiredAtLevel = requiredTeams.filter((t: any) => t.level === level);
      for (const team of atLevel) {
        if (team.friendly_name === 'default') continue;
        if (!requiredAtLevel.some((r: any) => r.friendlyName === team.friendly_name)) {
          await twilioDelete(`${FLEX}/Instances/${instanceSid}/Teams/${team.team_sid}`, auth);
          console.log(`Deleted team '${team.friendly_name}' (Level ${level})`);
        }
      }
    }
  }

  for (const level of [3, 2, 1]) {
    const atLevel = requiredTeams.filter((t: any) => t.level === level);
    for (const required of atLevel) {
      const exists = fetchedTeams.some((t: any) => t.friendly_name === required.friendlyName);
      if (!exists) {
        const body: Record<string, string> = {
          FriendlyName: required.friendlyName,
          Description: required.description,
          Level: level.toString(),
        };
        if (level < 3 && required.parentTeam) {
          const parent = fetchedTeams.find((t: any) => t.friendly_name === required.parentTeam);
          if (parent) body.ParentTeamSid = parent.team_sid;
        }
        const { data } = await twilioPost(`${FLEX}/Instances/${instanceSid}/Teams`, auth, body);
        fetchedTeams.push(data);
        console.log(`Created team '${required.friendlyName}' (Level ${level})`);
      } else {
        console.log(`Team '${required.friendlyName}' (Level ${level}) already exists`);
      }
    }
  }
}
