[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Terraform Init (Azure)

Runs `terraform init` and `terraform validate` using an Azure Storage Account as the remote state backend.
Authentication is handled via Azure Managed Identity (OIDC — no client secret required).

```yaml
steps:
  - name: Terraform Init
    uses: step-security/zingdevlimited-actions-helpers/azure/terraform-init@v4
    with:
      AZ_CLIENT_ID: ${{ vars.AZ_CLIENT_ID }}
      AZ_TENANT_ID: ${{ vars.AZ_TENANT_ID }}
      AZ_SUBSCRIPTION_ID: ${{ vars.AZ_SUBSCRIPTION_ID }}
      STORAGE_ACCOUNT_RESOURCEGROUP: ${{ vars.STORAGE_ACCOUNT_RESOURCEGROUP }}
      STORAGE_ACCOUNT_NAME: ${{ vars.STORAGE_ACCOUNT_NAME }}
      STORAGE_ACCOUNT_CONTAINER: ${{ vars.STORAGE_ACCOUNT_CONTAINER }}
      STORAGE_BLOB_NAME: ${{ inputs.ENVIRONMENT }}.tfstate
      TERRAFORM_DIRECTORY: ${{ github.workspace }}/infra
```
