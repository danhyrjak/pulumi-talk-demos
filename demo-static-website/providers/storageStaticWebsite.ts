import * as pulumi from "@pulumi/pulumi";
import * as cp from "child_process";
import * as url from "url";

export interface StorageStaticWebsiteInputs {
    accountName: pulumi.Input<string>;
}

interface StorageStaticWebsiteInputsUnwrapped {
    accountName: string;
}

interface StorageStaticWebsiteOutputsUnwrapped extends StorageStaticWebsiteInputsUnwrapped {
    endpoint: string;
    hostName: string;
    webContainerName: string;
}

interface StorageStaticWebsiteOutputs {
    accountName: pulumi.Output<string>;
    endpoint: pulumi.Output<string>;
    hostName: pulumi.Output<string>;
    webContainerName: pulumi.Output<string>;
}

// There's currently no way to enable the Static Web Site feature of a storage account via ARM
// Therefore, we created a custom provider which wraps corresponding Azure CLI commands
class StorageStaticWebsiteProvider implements pulumi.dynamic.ResourceProvider {

    public async check(olds: StorageStaticWebsiteInputs, news: StorageStaticWebsiteInputs): Promise<pulumi.dynamic.CheckResult> {
        const failures = [];

        if (!news.accountName) {
            failures.push({ property: "accountName", reason: "required property accountName missing" });
        }

        return { inputs: news, failures };
    }

    public async diff(
        id: pulumi.ID,
        olds: StorageStaticWebsiteOutputsUnwrapped,
        news: StorageStaticWebsiteInputsUnwrapped): Promise<pulumi.dynamic.DiffResult> {
        const replaces = [];

        if (olds.accountName !== news.accountName) {
            replaces.push("accountName");
        }

        return {
            changes: replaces.length > 0,
            replaces
        };
    }

    public async create(inputs: StorageStaticWebsiteInputsUnwrapped): Promise<pulumi.dynamic.CreateResult> {
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
}

export class StorageStaticWebsite
    extends pulumi.dynamic.Resource
    implements StorageStaticWebsiteOutputs {

    public readonly accountName: pulumi.Output<string>;
    public readonly endpoint: pulumi.Output<string>;
    public readonly hostName: pulumi.Output<string>;
    public readonly webContainerName: pulumi.Output<string>;

    constructor(name: string, args: StorageStaticWebsiteInputs, opts?: pulumi.CustomResourceOptions) {
        super(new StorageStaticWebsiteProvider(), name, { ...args, endpoint: undefined, hostName: undefined, webContainerName: undefined }, opts);
    }
}