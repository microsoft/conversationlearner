{
    "trainDialogs": [],
    "actions": [
        {
            "actionId": "b1129785-2dc0-4868-a724-392e624843e8",
            "createdDateTime": "2020-01-23T16:40:30.7479162-08:00",
            "actionType": "API_LOCAL",
            "payload": "{\"payload\":\"Callback Results All Types\",\"logicArguments\":[],\"renderArguments\":[]}",
            "isTerminal": true,
            "isEntryNode": false,
            "requiredEntitiesFromPayload": [],
            "requiredEntities": [],
            "negativeEntities": [],
            "requiredConditions": [],
            "negativeConditions": [],
            "clientData": {
                "importHashes": [],
                "mockResults": [
                    {
                        "name": "Set All Entities (Partial) - Model",
                        "entityValues": {
                            "8c25d28b-f4b5-429b-a6f3-a9ba7a8bec9a": "true",
                            "3e7d9ced-9cc6-4021-b46d-64ce09559967": [
                                "false",
                                "true"
                            ],
                            "10b12a24-dbc9-4ba7-9330-f1566f905c30": "3",
                            "03314720-9f51-438c-8d03-e6375022b1dc": [
                                "4",
                                "5"
                            ],
                            "9325bf02-c332-47e7-9342-8ad825a3c2fe": "my string value",
                            "f0efb99e-84b1-4e45-97df-a17ae0f1874e": null,
                            "ba7e977f-c529-478d-8d00-8f046a950741": null,
                            "1d415592-a031-4364-9fd7-7a9290f545e6": [
                                "{ \"id\": 1, \"title\": \"hello\" }"
                            ]
                        }
                    },
                    {
                        "name": "Entity Errors - Model",
                        "entityValues": {
                            "invalid-entity-ey": "true",
                            "3e7d9ced-9cc6-4021-b46d-64ce09559967": "false",
                            "10b12a24-dbc9-4ba7-9330-f1566f905c30": [
                                "4",
                                "5"
                            ],
                            "9325bf02-c332-47e7-9342-8ad825a3c2fe": "my string value",
                            "ba7e977f-c529-478d-8d00-8f046a950741": null,
                            "1d415592-a031-4364-9fd7-7a9290f545e6": [
                                "{ \"id\": 1, \"title\": \"hello\" }"
                            ]
                        }
                    },
                    {
                        "name": "Result to Delete",
                        "entityValues": {},
                        "returnValue": "2"
                    }
                ]
            }
        }
    ],
    "entities": [
        {
            "entityId": "8c25d28b-f4b5-429b-a6f3-a9ba7a8bec9a",
            "createdDateTime": "2020-01-23T16:40:30.747209-08:00",
            "entityName": "myBoolean",
            "entityType": "LOCAL",
            "isMultivalue": false,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "3e7d9ced-9cc6-4021-b46d-64ce09559967",
            "createdDateTime": "2020-01-23T16:40:30.7474773-08:00",
            "entityName": "myBooleans",
            "entityType": "LOCAL",
            "isMultivalue": true,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "10b12a24-dbc9-4ba7-9330-f1566f905c30",
            "createdDateTime": "2020-01-23T16:40:30.7476187-08:00",
            "entityName": "myNumber",
            "entityType": "LOCAL",
            "isMultivalue": false,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "03314720-9f51-438c-8d03-e6375022b1dc",
            "createdDateTime": "2020-01-23T16:40:30.7476376-08:00",
            "entityName": "myNumbers",
            "entityType": "LOCAL",
            "isMultivalue": true,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "9325bf02-c332-47e7-9342-8ad825a3c2fe",
            "createdDateTime": "2020-01-23T16:40:30.7476498-08:00",
            "entityName": "myString",
            "entityType": "LOCAL",
            "isMultivalue": false,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "f0efb99e-84b1-4e45-97df-a17ae0f1874e",
            "createdDateTime": "2020-01-23T16:40:30.7476573-08:00",
            "entityName": "myStrings",
            "entityType": "LOCAL",
            "isMultivalue": true,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "ba7e977f-c529-478d-8d00-8f046a950741",
            "createdDateTime": "2020-01-23T16:40:30.7476647-08:00",
            "entityName": "myObject",
            "entityType": "LOCAL",
            "isMultivalue": false,
            "isNegatible": false,
            "isResolutionRequired": false
        },
        {
            "entityId": "1d415592-a031-4364-9fd7-7a9290f545e6",
            "createdDateTime": "2020-01-23T16:40:30.7476723-08:00",
            "entityName": "myObjects",
            "entityType": "LOCAL",
            "isMultivalue": true,
            "isNegatible": false,
            "isResolutionRequired": false
        }
    ],
    "packageId": "51021574-24c1-44f2-b825-5a31369a1fef"
}