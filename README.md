## Features

GitSet Go: Show Custom Settings - This command retrieves a list of Custom Setting types into your command bar so you can select which Custom Settings you'd like to import and loads it into a file called force-app\main\default\.custom-settings\custom-settings.yaml (notice the . in the .custom-settings folder name)

i.e.
CustomSettingsDataKeys:
  - My_Custom_Setting__c
  - My_Other_Custom_Setting__c

GitSet Go: Retrieve Custom Settings Data - This command retrieves all Custom Settings records for the Custom Setting Types listed in the custom-settings.yaml and loads them into a folder structure in force-app\main\default\custom-settings (notice the lack of a . in the custom-settings folder name). It should product a folder named via the Custom Setting API name with 2 files in it. One, the json with the data and 2 a plan.json which just lists the files generated.

i.e.
force-app\main\default\custom-settings\My_Custom_Setting__c\My_Custom_Setting__c.json
{
    "records": [
        {
            "attributes": {
                "type": "My_Custom_Setting__c",
                "referenceId": "My_Custom_Setting__cRef1"
            },
            "Name": "Setting1",
            "Client_Name__c": "my_client",
            "Description__c": "The name of my client.",
            "Method__c": "distributor",
            "System_Domain__c": "myClient.com"
        },
        {
            "attributes": {
                "type": "My_Custom_Setting__c",
                "referenceId": "My_Custom_Setting__cRef2"
            },
            "Name": "Setting2",
            "Client_Name__c": "my_other_client",
            "Description__c": "The name of my other client.",
            "Method__c": "importer",
            "System_Domain__c": "myotherClient.com"
        }
    ]
}

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

**Enjoy!**
