import { validateSubscription } from '../_lib/subscription';
import { getAuth, getInput, setOutput, twilioGet, twilioGetAllPages, twilioDelete, twilioPostJson } from '../_lib/twilio';
import { readFileSync } from 'fs';

const CONTENT = 'https://content.twilio.com/v1/Content';

function sortedStringify(obj: any): string {
  return JSON.stringify(obj, (_: string, v: any) =>
    typeof v !== 'object' || v === null || Array.isArray(v)
      ? v
      : Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  );
}

function templatesEqual(a: any, b: any): boolean {
  return sortedStringify(a.types) + sortedStringify(a.variables) ===
    sortedStringify(b.types) + sortedStringify(b.variables);
}

export async function run(): Promise<void> {
  await validateSubscription();

  const configPath = getInput('CONFIG_PATH', true);
  const allowReplace = getInput('ALLOW_REPLACE') === 'true';
  const auth = getAuth();

  const configFile = JSON.parse(readFileSync(configPath, 'utf8'));
  const contentList = await twilioGetAllPages(CONTENT, auth, 'contents');

  const results: any = { templates: {} };

  for (const template of configFile.templates ?? []) {
    let existing = contentList.find((c: any) =>
      c.friendly_name.toLowerCase() === template.friendly_name.toLowerCase() &&
      c.language.toLowerCase() === template.language.toLowerCase()
    );

    if (existing && allowReplace && !templatesEqual(existing, template)) {
      await twilioDelete(`${CONTENT}/${existing.sid}`, auth);
      console.log(`Deleted template '${template.friendly_name}' (${template.language}) to replace`);
      existing = undefined;
    }

    if (!existing) {
      const { data } = await twilioPostJson(CONTENT, auth, template);
      console.log(`Created template '${template.friendly_name}' (${template.language}) ${data.sid}`);
      if (!results.templates[template.language]) results.templates[template.language] = {};
      results.templates[template.language][template.friendly_name] = data;
      contentList.push(data);
    } else {
      console.log(`Template '${template.friendly_name}' (${template.language}) ${existing.sid} unchanged`);
      if (!results.templates[template.language]) results.templates[template.language] = {};
      results.templates[template.language][template.friendly_name] = existing;
    }
  }

  setOutput('RESOURCES', JSON.stringify(results));
}
