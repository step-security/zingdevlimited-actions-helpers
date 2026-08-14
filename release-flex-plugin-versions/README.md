[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Release Flex Plugin Versions

Creates a Flex Plugin Release that activates the specified set of plugin versions in your Twilio Flex account.

A release bundles together one or more plugin versions and, when activated, determines which plugin code Flex agents load. Any plugin versions not listed in the release remain inactive.

```yaml
steps:
  (...)

  - name: Release Flex Plugins
    uses: step-security/zingdevlimited-actions-helpers/release-flex-plugin-versions@v4
    with:
      PLUGIN_VERSIONS: |
        my-plugin=1.2.0
        another-plugin=0.5.1
      RELEASE_NAME: "v2024.11.01"
      RELEASE_DESCRIPTION: "November deployment"
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```
