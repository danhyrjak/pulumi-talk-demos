# Pulumi Talk Demos
Code for the demos given during my Azure Oxford Pulumi Talk.
Slides: https://docs.google.com/presentation/d/1e6voP018z04vV-RqPCwspmXpt0dB__SqRfEmOy5q-qs

## Demo Basic Storage
Basic sample that creates a new Azure storage account and container.

This demo is used to show how to create a new stack (environment).

## Demo Static Website
More advance sample, extending the basic storage demo to expose a public static website via Azure blob storage and a CDN.

Note: configuration to do this is not currently avalaible via ARM so this sample demos how to write your own dynamic provider to do custom tasks.

The dynamic provider here just makes manual Azure CLI calls however you could create a dynamic provider to do anything you want. Some examples include, seeding database data or generating Lets Encrypt certificates using a third party package.

demo inspired by: https://github.com/pulumi/examples/tree/master/azure-ts-static-website
