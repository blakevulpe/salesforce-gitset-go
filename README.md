## Scope

This is an extension I built for my Dev Teams. We use a series of GitHub Actions to deploy Salesforce and Vlocity changes through our Salesforce environments. We recently implemented a way to deploy Custom Settings with our Git Tool, however the dev teams had to run manual commands in VS Code to retrieve the Custom Setting records and commit them to our GitHub repo. This tools makes life easier and quicker for our teams so they can use the extension interface to retrieve the records and commit them to a new feature branch.

I may add other functionality to this some day. Not sure. Feel free to give any ideas.

## Features

GitSet Go: Show Custom Settings - This command pulls up a page that shows all the Custom Setting types. From this page, you check whichever Custom Setting types you would like to deploy. You can use the search box to find the specific Custom Settings type you want. You can select more than one.

Once you have the types you want selected, Click Retrieve.
This opens up all Custom Settings records of the types selected in the right hand column. Select the specific records you would like to add or update in your feature branch.

Click Save + Retrieve Selected Records

This does 2 things. First, it creates a custom-setting.yaml in the force-app\main\default\.custom-settings\custom-settings.yaml (not the . at the beginning of custom-settings folder name). Much like a package.xml, this yaml will indicate which Custom Setting types and Records you’d like to deploy. Only what is noted in the custom-settings.yaml will deploy.

Second, it will create (or update) a folder for each Custom Settings type in the force-app\main\default\custom-settings folder (note the LACK of a . at the beginning of the custom-settings folder name). With each subfolder will be 2 files: a .json and a plan.json. The .json will have all records for that custom setting type (not just what you select).

## Requirements

You need to be logged into a salesforce org and have it set as the default org in VS Code. You'll need the Salesforce CLI installed on your maching and I'd ASSUME you're using the Salesforce Extension Pack.

## Known Issues

None yet.

## Release Notes

This is the first version of the extention. I'll likely add more functionality as people give feedback.

### 1.0.0

Initial release of Salesforce GitSet Go

### 1.0.1

changed the Custom Settings selection interface to a page and added a search box. 

### 1.0.2

Added an Icon for the extension. 

**Enjoy!**
