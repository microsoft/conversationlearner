/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager } from 'clwoz-sdk'
import { LuisSlot, Domain, DONTCARE, PICK_ONE } from './dataTypes'
import * as crypto from 'crypto'
import * as DB from './database'
import * as Utils from './utils'
//import * as Combined from './combined'

let ActivityResultsQueue: DB.ActivityResult[] = []
let OutputMap = new Map<string, string>()

//=================================
// dontcare
//=================================
export const apiDontCareArea = {
    name: "dontcare-area",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCarePrice = {
    name: "dontcare-price",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareFood = {
    name: "dontcare-food",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.FOOD, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareArrive = {
    name: "dontcare-arrive",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.ARRIVE_BY, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareLeave = {
    name: "dontcare-leave",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.LEAVE_AT, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCarePeople = {
    name: "dontcare-people",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PEOPLE, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareType = {
    name: "dontcare-type",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.TYPE, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareName = {
    name: "dontcare-name",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.NAME, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareStars = {
    name: "dontcare-stars",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.STARS, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareDay = {
    name: "dontcare-day",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.DAY, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

// Do nothing. Handle bad label
export const apiDontCareAddr = {
    name: "dontcare-addr",
    logic: async (memoryManager: ClientMemoryManager) => {
    }
}

//=================================
// Initialize Models
//=================================
export let clDispatch: ConversationLearner
const initDispatchModel = (clFactory: ConversationLearnerFactory) => {

    const modelId = ConversationLearnerFactory.modelIdFromName("dispatch")
    clDispatch = clFactory.create(modelId)

    clDispatch.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        Utils.ApplyEntitySubstitutions(memoryManager)
    }

    clDispatch.AddCallback({
        name: "Dispatch",
        logicWithSet: async (memoryManager: ClientMemoryManager, setGlobalCallback: (entityName: string, value: string) => void, activityId: string, domainNameString: string) => {

            var domainNames = domainNameString.split(",")

            // Add domain to queue
            var activityResult = ActivityResultsQueue.find(r => r.activityId === activityId)
            if (!activityResult) {
                activityResult = {
                    activityId,
                    creationTime: new Date().getTime(),
                    modelResults: new Map<string, DB.DomainResult>()
                }
                ActivityResultsQueue.push(activityResult)
            }

            // Add empty entry for each domain
            for (var domainName of domainNames) {
                activityResult.modelResults.set(domainName, null)
            }

            // DEBUG
            //debugActivityResultsQueue("DISPATCH");

            // Now await the result
            const result = await getActivityResultString(activityId)

            // Extract any globals
            const resultObj: string[][] = JSON.parse(result)
            const hotelName = resultObj.find(r => r[1] == "hotel" && r[2] == "name")
            if (hotelName) {
                setGlobalCallback(`global-hotel`, hotelName[3])
            }
            const restaurantName = resultObj.find(r => r[1] == "restaurant" && r[2] == "name")
            if (restaurantName) {
                setGlobalCallback(`global-restaurant`, restaurantName[3])
            }
            const attractionName = resultObj.find(r => r[1] == "attraction" && r[2] == "name")
            if (attractionName) {
                setGlobalCallback(`global-attraction`, attractionName[3])
            }


            OutputMap.set(activityId, result)
        }
    })
}

const getDomainDispatchCL = (domain: Domain, clFactory: ConversationLearnerFactory): ConversationLearner => {

    const modelId = ConversationLearnerFactory.modelIdFromName(domain)
    if (!modelId) {
        throw new Error(`Can't find model named ${domain}`)
    }
    const domainDispatchModel = clFactory.create(modelId)

    var slotNames = Utils.getSlotNames(domain)
    const slotMap = new Map()
    slotNames.forEach((entityName: string) => {
        return slotMap.set(Utils.shortName(entityName), entityName)
    })

    domainDispatchModel.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        DB.UpdateEntities(memoryManager, domain)
    }

    // Add callback for agent picking a database entry
    domainDispatchModel.AddCallback({
        name: "PickOne",
        logic: async (memoryManager: ClientMemoryManager) => {
            memoryManager.Set(PICK_ONE, "true")
            DB.UpdateDB(memoryManager, domain)
        }
    })

    domainDispatchModel.AddCallback({
        name: "Dispatch",
        logic: async (memoryManager: ClientMemoryManager, activityId: string, dialogActNameString: string) => {

            var dialogActNames = dialogActNameString.split(",")

            // Get queue item
            var activityResult = ActivityResultsQueue.find(r => r.activityId === activityId)

            if (!activityResult) {
                throw new Error("Missing activity result!")
            }

            // Add empty slot for each dialog act
            for (var dialogActName of dialogActNames) {
                activityResult.modelResults.set(dialogActName, null)

                // Remove domain slot
                var domainName = Utils.domainNameFromDialogAct(dialogActName)
                activityResult.modelResults.delete(domainName)
            }
            // DEBUG
            //debugActivityResultsQueue("MODEL");
        }
    })

    //=== "Same" Callbacks ===
    Object.values(LuisSlot).forEach(entityName => {
        var slotName = slotMap.get(entityName)
        if (slotName) {
            const e = entityName
            domainDispatchModel.AddCallback({
                name: `same-${entityName}`,
                logic: async (memoryManager: ClientMemoryManager) => {
                    var value = memoryManager.Get(`global-${e}`, ClientMemoryManager.AS_STRING)
                    memoryManager.Set(e, value as string)
                    DB.UpdateEntities(memoryManager, domain)
                }
            })
        }
    })
    AddSameName(domainDispatchModel, domain)
    AddDontCare(domainDispatchModel, domain)

    return domainDispatchModel
}

const AddSameName = (domainDispatchModel: ConversationLearner, domain: string): void => {

    if (domain === "taxi" || domain === "train") {
        ["restaurant", "attraction", "hotel"].forEach(source => {
            ["dest", "depart"].forEach(endpoint => {
                const s = source
                const e = endpoint
                domainDispatchModel.AddCallback({
                    name: `same-${e}-${s}`,
                    logic: async (memoryManager: ClientMemoryManager) => {
                        var place = memoryManager.Get(`global-${s}`, ClientMemoryManager.AS_STRING)
                        memoryManager.Set(e, place as string)
                        DB.UpdateEntities(memoryManager, domain)
                    }
                })
            })
        })
    }
}

const AddDontCare = (domainDispatchModel: ConversationLearner, domain: string): void => {

    if (domain === "restaurant") {
        domainDispatchModel.AddCallback(apiDontCareArea)
        domainDispatchModel.AddCallback(apiDontCarePrice)
        domainDispatchModel.AddCallback(apiDontCareFood)
        domainDispatchModel.AddCallback(apiDontCareType)
        domainDispatchModel.AddCallback(apiDontCareName)
        domainDispatchModel.AddCallback(apiDontCareStars)
        domainDispatchModel.AddCallback(apiDontCareDay)
        domainDispatchModel.AddCallback(apiDontCareAddr)
    }
    else if (domain === "train") {
        domainDispatchModel.AddCallback(apiDontCareArrive)
        domainDispatchModel.AddCallback(apiDontCareLeave)
        domainDispatchModel.AddCallback(apiDontCarePeople)
    }
    else if (domain === "hotel") {
        domainDispatchModel.AddCallback(apiDontCareArea)
        domainDispatchModel.AddCallback(apiDontCarePrice)
        domainDispatchModel.AddCallback(apiDontCareType)
        domainDispatchModel.AddCallback(apiDontCareName)
        domainDispatchModel.AddCallback(apiDontCareStars)
        domainDispatchModel.AddCallback(apiDontCareDay)
    }
    else if (domain === "taxi") {
        domainDispatchModel.AddCallback(apiDontCareArrive)
        domainDispatchModel.AddCallback(apiDontCareLeave)
    }
    else if (domain === "attraction") {
        domainDispatchModel.AddCallback(apiDontCareArea)
        domainDispatchModel.AddCallback(apiDontCarePrice)
        domainDispatchModel.AddCallback(apiDontCareType)
        domainDispatchModel.AddCallback(apiDontCareName)
    }
}

/* DEBUG
const debugActivityResultsQueue = (label: string) => {
    for (var ar of ActivityResultsQueue) {
        var outText = `${label}-${ar.activityId}`
        ar.modelResults.forEach((domainResult: DB.DomainResult | null, key: string) => {
            var output = domainResult ? JSON.stringify(domainResult.output) : "-"
            outText = outText + ` ${key}: ${output}`
        });
        console.log(outText)
    }
}
*/

const getDialogActCL = (dialogActName: string, clFactory: ConversationLearnerFactory): ConversationLearner | null => {

    const modelId = ConversationLearnerFactory.modelIdFromName(dialogActName)

    if (!modelId) {
        console.log(`No model named ${dialogActName}`)
        return null
    }
    const dialogActModel = clFactory.create(modelId)
    const domain = Utils.domainNameFromDialogAct(dialogActName)

    /* DEBUG
    dialogActModel.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
    console.log(JSON.stringify(memoryManager.curMemories));//LARS TEMP
    }
    */

    dialogActModel.AddCallback({
        name: "SendResult",
        logic: async (memoryManager: ClientMemoryManager, activityId: string, intent: string) => {

            const activityResult = ActivityResultsQueue.find(ar => ar.activityId === activityId)
            if (!activityId) {
                console.log(`Missing Activity ${activityId}`)
                return
                //throw new Error(`Missing Activity ${activityId}`)
            }
            if (!activityResult?.modelResults.has(dialogActName)) {
                if (activityResult) {
                    const result: DB.DomainResult = {
                        dialogActs : [],
                        entities : [],
                        output : [["Expired Missing Activity"]]
                    }
                    activityResult.modelResults.set(dialogActName, result)
                }
                console.log(`Expected DialogAct ${dialogActName}`)
                 //throw new Error(`Expected DialogAct ${dialogActName}`)
                return

            }

            //LARS const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            if (intent) {
                const dialogActs = intent.split(",")
                const entities = DB.getEntities(domain as Domain, memoryManager)
                const output = Utils.expandedResults(dialogActs, entities)

                const result: DB.DomainResult = {
                    dialogActs,
                    entities,
                    output
                }
                activityResult.modelResults.set(dialogActName, result)
            }
            // No action is possible to required entities
            else {
                activityResult.modelResults.delete(dialogActName)
            }
        }
    })
    return dialogActModel
}

export let clAttraction: ConversationLearner
export let clHotel: ConversationLearner
export let clRestaurant: ConversationLearner
export let clTaxi: ConversationLearner
export let clTrain: ConversationLearner
const clDialogActsMap = new Map<string, ConversationLearner>()

export const createModels = async (clFactory: ConversationLearnerFactory, modelId?: string, authKey?: string) => {
    console.log('========= CREATING MODELS ==========')
    let cl = clFactory.create(modelId)
    const hashedKey = authKey ? crypto.createHash('sha256').update(authKey).digest('hex') : ""
    const id = `MW-${hashedKey}`
    const query = `userId=${id}`
    const appList = await cl.clRunner.clClient.GetApps(query)

    ConversationLearnerFactory.setAppList(appList)

    //Combined.initCombinedModel(clFactory)
    try {
        initDispatchModel(clFactory)
        clAttraction = getDomainDispatchCL(Domain.ATTRACTION, clFactory)
        clHotel = getDomainDispatchCL(Domain.HOTEL, clFactory)
        clRestaurant = getDomainDispatchCL(Domain.RESTAURANT, clFactory)
        clTaxi = getDomainDispatchCL(Domain.TAXI, clFactory)
        clTrain = getDomainDispatchCL(Domain.TRAIN, clFactory)

        var dacts = DB.DialogActs()
        for (var dialogAct of dacts) {
            var daModel = getDialogActCL(dialogAct, clFactory)
            if (daModel) {
                clDialogActsMap.set(dialogAct, daModel)
            }
        }
    }
    catch (e) {
        console.log(e)
    }

}

export const StopActivity = () => {
    for (var interval of getActivityResultIntervals) {
        clearInterval(interval)
    }
    for (var interval of outputIntervals) {
        clearInterval(interval)
    }
    for (var activityResult of ActivityResultsQueue) {
        activityResult.modelResults = new Map<string, DB.DomainResult>()
    }
}

var getActivityResultIntervals: NodeJS.Timeout[] = []
var getActivityResultString = (activityId: string) => {
    var promise = new Promise<string>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                var activityResult = ActivityResultsQueue.find(r => r.activityId === activityId)
                if (!activityResult) {
                    console.log(`Expected activity result ${activityId}`)

                    // Check from timeout
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 200000) {
                        console.log(`Expire Activity: ${activityId} ${curTime} ${startTime}`)
                        getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                    }
                    return
                }
                var isDone = true
                activityResult.modelResults.forEach((value: DB.DomainResult | null, key: string) => {
                    if (value == null) {
                        isDone = false
                    }
                })

                if (isDone) {
                    getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                    clearInterval(interval)
                    // Clear data
                    ActivityResultsQueue = ActivityResultsQueue.filter(r => r.activityId !== activityId)

                    const result = Utils.ActivityResultToString(activityResult)
                    resolve(result)
                }
            }
            , 1000)
        getActivityResultIntervals.push(interval)
    })
    return promise
}

// Remove any duplicates
const CleanOutput = (output: string): string => {
    var outputObj: string[][] = JSON.parse(output)
    var cleanedObj: string[][] = []
    outputObj.forEach(o =>
    {
        if (!cleanedObj.find(e => e[0]==o[0] && e[1]==o[1] && e[2]==o[2] && e[3] == o[3])) {
            cleanedObj.push(o)
        }
    })
    return JSON.stringify(cleanedObj);
}

var outputIntervals: NodeJS.Timeout[] = []
export const GetOutput = (activityId: string) => {
    var promise = new Promise<string>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                const output = OutputMap.get(activityId)
                if (!output) {
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 500000) {
                        var message = `Expire Output: ${activityId} ${curTime} ${startTime}`
                        console.log(message)
                        outputIntervals = outputIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                        resolve(message)
                    }
                    return
                }
                outputIntervals = outputIntervals.filter(i => i !== interval)
                clearInterval(interval)
                // Clear data
                OutputMap.delete(activityId)
                var cleaned = CleanOutput(output)
                resolve(cleaned)
            }
            , 1000)
        outputIntervals.push(interval)
    })
    return promise
}