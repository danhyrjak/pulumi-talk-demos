///example dynamic resource provider. For more details on dynamic providers see the official docs:
// https://www.pulumi.com/docs/intro/concepts/programming-model/#dynamicproviders

import * as pulumi from "@pulumi/pulumi";
import * as cp from "child_process";
import * as url from "url";

export interface AzureStorageStaticWebsiteInputs {
    accountName: pulumi.Input<string>;
}

interface AzureStorageStaticWebsiteInputsUnwrapped {
    accountName: string;
}

interface AzureStorageStaticWebsiteOutputsUnwrapped extends AzureStorageStaticWebsiteInputsUnwrapped {
    endpoint: string;
    hostName: string;
    webContainerName: string;
}

interface AzureStorageStaticWebsiteOutputs {
    accountName: pulumi.Output<string>;
    endpoint: pulumi.Output<string>;
    hostName: pulumi.Output<string>;
    webContainerName: pulumi.Output<string>;
}

// There's currently no way to enable the Static Web Site feature of a storage account via ARM
// or the inbuild provider, therefore, we created a custom provider which wraps corresponding Azure CLI commands
class AzureStorageStaticWebsiteProvider implements pulumi.dynamic.ResourceProvider {

    // optional. if specified this method should validate the inputs and return them.
    // the inputs can be altered here if required. if an error is thrown here the provider
    // exits out early and no other methods are called.
    public async check(
        olds: AzureStorageStaticWebsiteInputsUnwrapped,
        news: AzureStorageStaticWebsiteInputsUnwrapped): Promise<pulumi.dynamic.CheckResult> {
        const failures = [];

        if (!news.accountName) {
            failures.push({ property: "accountName", reason: "required property accountName missing" });
        }

        return { inputs: news, failures };
    }

    // optional. if specified called when a resource already exists in the pulumi state and the program runs.
    // this method decides if an update is required, and if it is does it have to be a replacement or update.
    // if no method is defined the resource is only created once and never altered.
    public async diff(
        id: pulumi.ID,
        olds: AzureStorageStaticWebsiteOutputsUnwrapped,
        news: AzureStorageStaticWebsiteInputsUnwrapped): Promise<pulumi.dynamic.DiffResult> {
        const replaces = [];

        // if storage account name changes then need to remove old and create new.
        if (olds.accountName !== news.accountName) {
            replaces.push("accountName");
        }

        return {
            changes: replaces.length > 0,
            replaces
        };
    }

    // required. called when a new resource is created or when diff requires an update that requires deletion and re-creation.
    // this method must be specified and it returns the id of the resource and the outputs.
    public async create(inputs: AzureStorageStaticWebsiteInputsUnwrapped): Promise<pulumi.dynamic.CreateResult> {
        // Helper function to execute a command, supress the warnings from polluting the output, and parse the result as JSON
        const executeToJson = (command: string) => JSON.parse(cp.execSync(command, { stdio: ["pipe", "pipe", "ignore"] }).toString());

        // Install Azure CLI extension for storage (currently, only the preview version has the one we need)
        cp.execSync("az extension add --name storage-preview", { stdio: "ignore" });

        // Update the service properties of the storage account to enable static website and validate the result
        const update = executeToJson(`az storage blob service-properties update --account-name "${inputs.accountName}" --static-website --404-document 404.html --index-document index.html`);
        if (!update.staticWebsite.enabled) {
            throw new Error(`Static website update failed: ${update}`);
        }

        // Extract the web endpoint and the hostname from the storage account
        const endpoint = executeToJson(`az storage account show -n "${inputs.accountName}" --query "primaryEndpoints.web"`);
        const hostName = url.parse(endpoint).hostname;

        // Files for static websites should be stored in a special built-in container called '$web', see https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website
        const webContainerName = "$web";

        return {
            id: `${inputs.accountName}StaticWebsite`,
            outs: {
                accountName: inputs.accountName,
                endpoint,
                hostName,
                webContainerName
            },
        };
    }

    // public async update(
    //     id: pulumi.ID,
    //     news: AzureStorageStaticWebsiteInputsUnwrapped,
    //     olds: AzureStorageStaticWebsiteOutputsUnwrapped): Promise<pulumi.dynamic.UpdateResult> {
    // optional. if specified called when an update is required on an existing tracked
    // resource in the pulumi state file. returns the update outputs.
    // }

    // public async delete(id: pulumi.ID, olds: AzureStorageStaticWebsiteOutputsUnwrapped) {
    //     // optional. if specified called when the resource needs to be deleted.
    // }

    // public async read(id: pulumi.ID, olds: AzureStorageStaticWebsiteOutputsUnwrapped){
    //    // optional. can be used to get references for resource where data is not
    //    // kept track of in the pulumi state store.
    // }

}

// exported component that uses the provider defined above
export default class AzureStorageStaticWebsite
    extends pulumi.dynamic.Resource
    implements AzureStorageStaticWebsiteOutputs {

    public readonly accountName: pulumi.Output<string>;
    public readonly endpoint: pulumi.Output<string>;
    public readonly hostName: pulumi.Output<string>;
    public readonly webContainerName: pulumi.Output<string>;

    constructor(name: string, args: AzureStorageStaticWebsiteInputs, opts?: pulumi.CustomResourceOptions) {
        super(new AzureStorageStaticWebsiteProvider(), name, { ...args, endpoint: undefined, hostName: undefined, webContainerName: undefined }, opts);
    }
}