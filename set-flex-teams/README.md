[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Set Flex Teams

Keeps the team structure of a Twilio Flex instance in step with a JSON file checked into your repository.

Teams in Flex sit in a three-tier hierarchy. Level 3 is the outermost tier, level 2 nests inside level 3, and level 1 nests inside level 2. The action creates teams from the top down so a parent always exists before the children that point at it.

## Usage

```yaml
steps:
  - name: Check out the teams config
    uses: actions/checkout@v7
    with:
      sparse-checkout: teams.json
      sparse-checkout-cone-mode: false

  - name: Apply Flex teams
    uses: step-security/zingdevlimited-actions-helpers/set-flex-teams@v4
    with:
      CONFIG_PATH: teams.json
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `CONFIG_PATH` | yes | Path to the JSON file described below. Check it out before this step runs. |
| `DELETE_UNUSED` | no | `true` removes teams that exist on the instance but are missing from the config, making the file the single source of truth. Defaults to `false`. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

## Configuration file

A single `teams` array. Each entry:

| Field | Required | Description |
| --- | --- | --- |
| `friendlyName` | yes | Display name, and the value used to match against teams already on the instance. |
| `level` | yes | `3`, `2` or `1` — outermost to innermost. |
| `description` | no | Free-text description stored on the team. |
| `parentTeam` | for levels 2 and 1 | `friendlyName` of the containing team, which must be one level above this one. |

Matching is by name only, so renaming a team in the config reads as a delete plus a create rather than a rename. The instance's built-in `default` team is never removed, even with `DELETE_UNUSED` enabled.

### Example

```json
{
  "teams": [
    {
      "friendlyName": "Contact Centre",
      "description": "All customer-facing staff",
      "level": 3
    },
    {
      "friendlyName": "Billing",
      "description": "Accounts and payments",
      "level": 2,
      "parentTeam": "Contact Centre"
    },
    {
      "friendlyName": "Billing — Escalations",
      "description": "Second-line billing queries",
      "level": 1,
      "parentTeam": "Billing"
    }
  ]
}
```
