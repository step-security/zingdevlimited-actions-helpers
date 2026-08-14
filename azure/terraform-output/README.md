[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Terraform Output

Reads the outputs of a Terraform state file held in Azure Blob Storage, letting a deployment job consume values produced by infrastructure that Terraform provisioned — resource names, connection details, generated SIDs — without running Terraform itself.

The state blob is only read, never locked or modified.

## Usage

```yaml
- name: Read the Terraform outputs
  id: tf
  uses: step-security/zingdevlimited-actions-helpers/azure/terraform-output@v5
  with:
    AZ_TENANT_ID: ${{ vars.AZ_TENANT_ID }}
    AZ_CLIENT_ID: ${{ vars.AZ_CLIENT_ID }}
    AZ_SUBSCRIPTION_ID: ${{ vars.AZ_SUBSCRIPTION_ID }}
    STORAGE_ACCOUNT_RESOURCEGROUP: ${{ vars.TF_STATE_RESOURCEGROUP }}
    STORAGE_ACCOUNT_NAME: ${{ vars.TF_STATE_ACCOUNT }}
    STORAGE_ACCOUNT_CONTAINER: tfstate
    STORAGE_BLOB_NAME: azure-${{ inputs.ENVIRONMENT }}.tfstate

- name: Use an output
  run: echo "Deploying to $APP_NAME"
  env:
    APP_NAME: ${{ fromJson(steps.tf.outputs.TERRAFORM_OUTPUTS).APP_NAME.value }}
```

Azure login uses OIDC federated credentials, so the job needs:

```yaml
permissions:
  id-token: write
  contents: read
```

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `AZ_TENANT_ID` | yes | Entra ID tenant. |
| `AZ_CLIENT_ID` | yes | Client ID of the identity federated with GitHub. |
| `AZ_SUBSCRIPTION_ID` | yes | Subscription owning the storage account. |
| `STORAGE_ACCOUNT_RESOURCEGROUP` | yes | Resource group of the state storage account. |
| `STORAGE_ACCOUNT_NAME` | yes | Storage account holding the state. |
| `STORAGE_ACCOUNT_CONTAINER` | yes | Blob container holding the state. |
| `STORAGE_BLOB_NAME` | yes | Blob name of the state file. |
| `AUTH_MODE` | no | `key` (default) or `login` — see below. |
| `SKIP_AZURE_LOGIN` | no | `true` when an earlier step in the job already logged in. |
| `EXPORT_OUTPUTS` | no | Comma-separated output names to also write into `GITHUB_ENV`. |

## Outputs

| Name | Description |
| --- | --- |
| `TERRAFORM_OUTPUTS` | JSON object of every output in the state file, each entry keeping Terraform's `{ "value": ..., "type": ... }` shape. |

## Reading values

Because the JSON preserves Terraform's own structure, each output is reached through `.value`:

```yaml
    APP_NAME: ${{ fromJson(steps.tf.outputs.TERRAFORM_OUTPUTS).APP_NAME.value }}
```

`EXPORT_OUTPUTS` avoids that indirection for values used repeatedly, writing them into the environment for every later step in the job:

```yaml
- name: Read the Terraform outputs
  id: tf
  uses: step-security/zingdevlimited-actions-helpers/azure/terraform-output@v5
  with:
    # (...)
    EXPORT_OUTPUTS: TWILIO_ACCOUNT_SID,FUNCTIONS_APP_NAME

- name: Use the exported values
  run: |
    echo "Account: $TWILIO_ACCOUNT_SID"
    echo "App:     $FUNCTIONS_APP_NAME"
```

## Choosing an auth mode

`AUTH_MODE` decides how the blob itself is read, which is a different permission from the one that logs you in:

| Mode | How the blob is read | Role needed |
| --- | --- | --- |
| `key` (default) | Fetches the storage account access key, then uses it. | **Storage Account Contributor** or higher on the account. |
| `login` | Uses the logged-in identity directly against the blob. | **Storage Blob Data Reader** or higher on the container. |

`login` is the tighter of the two, since it needs no key-listing rights and involves no account key at all. Prefer it unless the identity cannot be granted a data-plane role on the container.

> [!NOTE]
> Terraform state holds every value the configuration touched, including ones marked sensitive. Treat the state container as a secret store and keep its access limited accordingly.
