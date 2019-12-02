import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";
import { StorageStaticWebsite } from "./providers/storageStaticWebsite";
import * as fs from "fs";
import * as path from "path";

// get reference to azure config settings
const azureConfig = new pulumi.Config("azure");

// create default tags object for all resources in this program
const defaultTags = {
    stack: pulumi.getStack(),
}

// create prefix to use for all resources in this program
const prefix: string = "demo02";

// create an Azure resource group
const resourceGroup = new azure.core.ResourceGroup(`${prefix}rg`, {
    location: azureConfig.require("location"),
    tags: {
        ...defaultTags,
    }
});

// create common args object, holds common args used accross multiple resources
const commonArgs = {
    location: resourceGroup.location,
    resourceGroupName: resourceGroup.name,
    tags: {
        ...defaultTags,
    },
};

// create a storage account
const storageAccount = new azure.storage.Account(`${prefix}sa`, {
    accountReplicationType: "LRS",
    accountKind: "StorageV2",
    accountTier: "Standard",
    ...commonArgs,
});

export const resourceGroupName = resourceGroup.name;

// read files from data directory, validate minimum required exist
const siteSourcefilesPath = path.join(".", "data", "wwwroot");
const files = fs.readdirSync(siteSourcefilesPath);
if (files.indexOf("index.html") === -1) {
    throw new Error("index.html missing from data/wwwroot");
}
if (files.indexOf("404.html") === -1) {
    throw new Error("404.html missing from data/wwwroot");
}

// create and configure blob container to host static website
const staticWebsite = new StorageStaticWebsite(`${prefix}website`, {
    accountName: storageAccount.name,
});

// upload files
files.map((filename) => new azure.storage.Blob(`${prefix}${filename}`, {
    name: filename,
    storageAccountName: staticWebsite.accountName,
    storageContainerName: staticWebsite.webContainerName,
    type: "block",
    source: `${siteSourcefilesPath}/${filename}`,
    contentType: "text/html", // TODO: support other file types
})); // TODO: handle file changes

// Web endpoint to the website
export const staticEndpoint = staticWebsite.endpoint;

// add a CDN in front of the website
const cdn = new azure.cdn.Profile(`${prefix}cdn`, {
    resourceGroupName: resourceGroup.name,
    sku: "Standard_Microsoft",
});

const cdnEndpointResource = new azure.cdn.Endpoint(`${prefix}cdn-ep`, {
    resourceGroupName: resourceGroup.name,
    profileName: cdn.name,
    originHostHeader: staticWebsite.hostName,
    origins: [{
        name: "blobstorage",
        hostName: staticWebsite.hostName,
    }],
});

// CDN endpoint to the website.
export const cdnEndpoint = pulumi.interpolate`https://${cdnEndpointResource.hostName}/`;
