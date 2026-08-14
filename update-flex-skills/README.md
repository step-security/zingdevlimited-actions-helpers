[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Update Flex Skills

Maintains the worker skill list in the Flex Configuration, which is what supervisors pick from when assigning skills and what Taskrouter queue expressions match against.

Skills are matched by name and existing entries are never rewritten, so a skill that already exists keeps whatever levels it was given. New names are appended.

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `SIMPLE_SKILLS` | one of the two | Newline-separated skill names, with no levels. |
| `COMPLEX_SKILLS` | one of the two | JSON array of skill objects, for skills that carry levels. |
| `MODE` | no | `merge` (default) appends to the account's current skills. `replace` discards them and keeps only what this step supplies. |
| `TWILIO_API_KEY` | yes | API Key SID. |
| `TWILIO_API_SECRET` | yes | API Key secret. |

At least one of `SIMPLE_SKILLS` and `COMPLEX_SKILLS` has to be set; supplying both is fine and the two lists are combined.

## Skills without levels

A newline-separated list is enough when a worker either has the skill or does not:

```yaml
  - name: Apply worker skills
    uses: step-security/zingdevlimited-actions-helpers/update-flex-skills@v5
    with:
      SIMPLE_SKILLS: |
        billing
        technical
        retentions
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Skills with levels

To let a skill carry a proficiency, pass a JSON array. Each object takes:

| Field | Description |
| --- | --- |
| `name` | Skill name. |
| `multivalue` | `true` if a worker can hold several values for this skill. |
| `minimum` | Lowest level accepted, or `null` for no level. |
| `maximum` | Highest level accepted, or `null` for no level. |

```yaml
  - name: Apply worker skills
    uses: step-security/zingdevlimited-actions-helpers/update-flex-skills@v5
    with:
      COMPLEX_SKILLS: |
        [
          { "name": "billing", "multivalue": false, "minimum": 1, "maximum": 5 },
          { "name": "technical", "multivalue": true, "minimum": 1, "maximum": 3 },
          { "name": "retentions", "multivalue": false, "minimum": null, "maximum": null }
        ]
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

## Replacing the list

`MODE: replace` makes the workflow the single source of truth, dropping any skill added by hand in the Flex Console.

```yaml
  - name: Reset worker skills
    uses: step-security/zingdevlimited-actions-helpers/update-flex-skills@v5
    with:
      MODE: replace
      SIMPLE_SKILLS: |
        billing
        technical
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

> [!NOTE]
> Removing a skill from the configuration does not strip it from workers who already have it, and Taskrouter expressions referencing it keep evaluating. Check your queues before dropping a skill in `replace` mode.
