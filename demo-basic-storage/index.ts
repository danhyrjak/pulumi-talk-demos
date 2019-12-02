import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";

// get reference to azure config settings
const azureConfig = new pulumi.Config("azure");

// create default tags object for all resources in this program
const defaultTags = {
    stack: pulumi.getStack(),
}

// create prefix to use for all resources in this program
const prefix: string = "demo01";

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
