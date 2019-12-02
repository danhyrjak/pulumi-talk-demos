import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as path from "path";
import * as fs from "fs";
import AzureStorageStaticWebsite from "../providers/azureStorageStaticWebsite";

export interface StaticWebsiteProps {
    storageAccount: azure.storage.Account;
}

// logical component to group related storage website resource functionality together
// to expose as one resource. Note: no state is used for this wrapper component
// so it will be executed on every run of the application. 
export default class StaticWebsite extends pulumi.ComponentResource {
    public readonly staticWebsite: AzureStorageStaticWebsite;

    constructor(name: string, props: StaticWebsiteProps, opts?: pulumi.ComponentResourceOptions) {
        super("demo:staticWebsite", name, {}, opts);

        const requiredFiles = ["index.html", "404.html"];
        const allowedFileExtContentTypeMapping: { [key: string]: string } = {
            "css": "text/css",
            "html": "text/html",
            "htm": "text/html",
            "js": "application/javascript",
            "json": "application/json",
            "pdf": "application/pdf",
            "txt": "text/plain",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
        };

        const getFileExtenstion = (filename: string) => {
            return filename.substr(filename.lastIndexOf(".") + 1).toLowerCase();
        }

        // read files from data directory and validate
        const siteSourcefilesPath = path.join(".", "data", "wwwroot");
        const files = fs.readdirSync(siteSourcefilesPath);

        // 1. check  for required files
        requiredFiles.forEach((filename) => {
            if (files.indexOf(filename) === -1) {
                throw new Error(`required file: ${filename} missing from ${siteSourcefilesPath}`);
            }
        });

        // 2. check all supplied files are supported
        const allowedExtenstions = Object.keys(allowedFileExtContentTypeMapping);
        const invalidFiles = files.filter((filename) => allowedExtenstions.indexOf(getFileExtenstion(filename)) === -1);
        if (invalidFiles.length > 0) {
            throw new Error(`The following ${invalidFiles.length} files in ${siteSourcefilesPath} have a unsupported file extenstion:\n${invalidFiles.join("\n")}`);
        }

        // all valid, create and configure blob container to host static website (via custom dynamicProvider)
        this.staticWebsite = new AzureStorageStaticWebsite(`${name}-website`, {
            accountName: props.storageAccount.name,
        });

        // upload files, will reupload fresh file if content changed as tracked by Pulumi
        files.map((filename) => new azure.storage.Blob(`${name}-${filename}`, {
            contentType: allowedFileExtContentTypeMapping[getFileExtenstion(filename)],
            name: filename,
            sourceContent: fs.readFileSync(`${siteSourcefilesPath}/${filename}`, "utf8"),
            storageAccountName: this.staticWebsite.accountName,
            storageContainerName: this.staticWebsite.webContainerName,
            type: "block",
        }));

        this.registerOutputs({
            staticWebsite: this.staticWebsite,
        });
    }
}