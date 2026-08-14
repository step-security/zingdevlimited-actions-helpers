[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Format App Settings

Turns a readable `KEY=VALUE` block into the JSON array shape Azure App Service and Functions expect for app settings, so a workflow can keep its configuration legible instead of embedding hand-written JSON.

## Usage

```yaml
- name: Build the app settings
  id: appSettings
  uses: step-security/zingdevlimited-actions-helpers/azure/format-app-settings@v4
  with:
    APP_SETTINGS_ENV: |
      WEBSITE_RUN_FROM_PACKAGE=1
      SERVICE_BUS_NAME=${{ vars.SERVICE_BUS_NAME }}
      APPINSIGHTS_INSTRUMENTATIONKEY=${{ secrets.APPINSIGHTS_KEY }}

- name: Apply them
  run: az functionapp config appsettings set --name my-app --settings "$SETTINGS"
  env:
    SETTINGS: ${{ steps.appSettings.outputs.APP_SETTINGS }}
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `APP_SETTINGS_ENV` | yes | One `KEY=VALUE` per line. |
| `STICKY_SETTINGS` | no | Comma-separated setting names to mark as slot-sticky, so they stay with the deployment slot across a swap. |
| `ENCRYPT_OUTPUT` | no | `true` to encrypt the result — see below. |
| `ENCRYPTION_PASSWORD` | no | Required when `ENCRYPT_OUTPUT` is `true`. |
| `ENCRYPTION_FLAGS` | no | OpenSSL cipher flags. Defaults to `-aes-256-cbc -pbkdf2 -salt`. |

## Outputs

| Name | Description |
| --- | --- |
| `APP_SETTINGS` | The settings JSON, or a base64 string of the encrypted JSON when `ENCRYPT_OUTPUT` is on. |
| `ENCRYPTED` | `true` or `false`, so a consuming step can tell which form it received. |

## Passing settings between jobs

App settings usually contain secrets, and a step output carrying a secret is not something to hand to another job in the clear. With `ENCRYPT_OUTPUT: true` the JSON is encrypted with OpenSSL and emitted as base64, which is safe to move through a job output or an artifact and decrypt where it is needed.

```yaml
- name: Build the app settings
  id: appSettings
  uses: step-security/zingdevlimited-actions-helpers/azure/format-app-settings@v4
  with:
    ENCRYPT_OUTPUT: true
    ENCRYPTION_PASSWORD: ${{ secrets.SETTINGS_ENCRYPTION_PASSWORD }}
    APP_SETTINGS_ENV: |
      APPINSIGHTS_INSTRUMENTATIONKEY=${{ secrets.APPINSIGHTS_KEY }}
      SQL_CONNECTION_STRING=${{ secrets.SQL_CONNECTION_STRING }}
```

Decrypt in the consuming job with the same password and the same flags:

```yaml
- name: Decrypt the settings
  run: |
    echo "$ENCRYPTED_SETTINGS" | base64 -d |
      openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass env:PASSWORD > settings.json
  env:
    ENCRYPTED_SETTINGS: ${{ needs.build.outputs.app_settings }}
    PASSWORD: ${{ secrets.SETTINGS_ENCRYPTION_PASSWORD }}
```

Override `ENCRYPTION_FLAGS` only if you have a reason to, and give the decrypting side the identical flags — a mismatch surfaces as a decryption failure rather than anything more descriptive.
