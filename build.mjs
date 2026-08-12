import { execSync } from "child_process";
import { existsSync } from "fs";

const actions = [
  "create-flex-plugin-version",
  "deploy-assets",
  "deploy-flex-plugin-asset",
  "get-twilio-functions-service",
  "get-twilio-resource-sid",
  "install-library-flex-plugin",
  "register-event-stream-webhook",
  "release-flex-plugin-versions",
  "reset-twilio-account",
  "set-flex-teams",
  "update-content-templates",
  "update-flex-skills",
  "update-sync",
  "update-taskrouter",
  "update-twilio-functions-variables",
];

for (const action of actions) {
  const entry = `${action}/main.ts`;
  if (!existsSync(entry)) {
    console.warn(`Skipping ${action}: no main.ts found`);
    continue;
  }
  console.log(`Building ${action}...`);
  execSync(`node_modules/.bin/ncc build ${entry} -o ${action}/dist`, { stdio: "inherit" });
}
