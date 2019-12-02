import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";
import StaticWebsite from "./components/StaticWebsite";

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

// create a container
const storageContainer = new azure.storage.Container(`${prefix}sa-c1`, {
    storageAccountName: storageAccount.name,
});

export const resourceGroupName = resourceGroup.name;

const sw = new StaticWebsite(`${prefix}sw`, {
    storageAccount,
});

// export web endpoint to the static website
export const staticEndpoint = sw.staticWebsite.endpoint;

// add a CDN & endpoint in front of the website
const cdn = new azure.cdn.Profile(`${prefix}cdn`, {
    resourceGroupName: resourceGroup.name,
    sku: "Standard_Microsoft",
});

const cdnEndpointResource = new azure.cdn.Endpoint(`${prefix}cdn-ep`, {
    resourceGroupName: resourceGroup.name,
    profileName: cdn.name,
    originHostHeader: sw.staticWebsite.hostName,
    origins: [{
        name: "blobstorage",
        hostName: sw.staticWebsite.hostName,
    }],
});

// export CDN endpoint to the website.
// using pulumi interpolate to manipulate from a resource Output.
export const cdnEndpoint = pulumi.interpolate`https://${cdnEndpointResource.hostName}/`;
