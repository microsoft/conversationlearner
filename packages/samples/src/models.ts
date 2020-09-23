/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager, IGlobalCallbackValues } from 'clwoz-sdk'
import { LuisSlot, Domain, DONTCARE, PICK_ONE, ASK_TYPES, RestaurantSlot, HotelSlot, AttractionSlot, TrainSlot, TaxiSlot } from './dataTypes'
import * as crypto from 'crypto'
import * as DB from './database'
import * as Utils from './utils'

let ActivityResultsQueue: DB.ActivityResult[] = []
let OutputMap = new Map<string, string>()

//=================================
// dontcare
//=================================
export const apiDontCareRestaurantArea = {
    name: "dontcare-area",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)

        memoryManager.Delete(RestaurantSlot.AREA)
        memoryManager.Delete(RestaurantSlot.AREA_COUNT)

        memoryManager.Set(RestaurantSlot.AREA, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelArea = {
    name: "dontcare-area",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)

        memoryManager.Delete(HotelSlot.AREA)
        memoryManager.Delete(HotelSlot.AREA_COUNT)

        memoryManager.Set(HotelSlot.AREA, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareAttractionArea = {
    name: "dontcare-area",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)

        memoryManager.Delete(AttractionSlot.AREA)
        memoryManager.Delete(AttractionSlot.AREA_COUNT)

        memoryManager.Set(AttractionSlot.AREA, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareRestaurantPrice = {
    name: "dontcare-price",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)

        memoryManager.Delete(RestaurantSlot.PRICERANGE)
        memoryManager.Delete(RestaurantSlot.PRICERANGE_COUNT)

        memoryManager.Set(RestaurantSlot.PRICERANGE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelPrice = {
    name: "dontcare-price",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)

        memoryManager.Delete(HotelSlot.PRICERANGE)
        memoryManager.Delete(HotelSlot.PRICERANGE_COUNT)

        memoryManager.Set(HotelSlot.PRICERANGE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareAttractionPrice = {
    name: "dontcare-price",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)

        memoryManager.Delete(AttractionSlot.PRICERANGE)
        memoryManager.Delete(AttractionSlot.PRICERANGE_COUNT)

        memoryManager.Set(AttractionSlot.PRICERANGE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}
export const apiDontCareRestaurantFood = {
    name: "dontcare-food",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.FOOD, DONTCARE)

        memoryManager.Delete(RestaurantSlot.FOOD)
        memoryManager.Delete(RestaurantSlot.FOOD_COUNT)

        memoryManager.Set(RestaurantSlot.FOOD, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareTrainArrive = {
    name: "dontcare-arrive",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.ARRIVE_BY, DONTCARE)

        memoryManager.Delete(TrainSlot.ARRIVE_BY)
        memoryManager.Delete(TrainSlot.ARRIVE_BY_COUNT)

        memoryManager.Set(TrainSlot.ARRIVE_BY, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareTaxiArrive = {
    name: "dontcare-arrive",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.ARRIVE_BY, DONTCARE)

        memoryManager.Delete(TaxiSlot.ARRIVE_BY)
        memoryManager.Delete(TaxiSlot.ARRIVE_BY_COUNT)

        memoryManager.Set(TaxiSlot.ARRIVE_BY, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareTaxiLeave = {
    name: "dontcare-leave",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.LEAVE_AT, DONTCARE)

        memoryManager.Delete(TaxiSlot.LEAVE_AT)
        memoryManager.Delete(TaxiSlot.LEAVE_AT_COUNT)

        memoryManager.Set(TaxiSlot.LEAVE_AT, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareTrainLeave = {
    name: "dontcare-leave",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.LEAVE_AT, DONTCARE)

        memoryManager.Delete(TrainSlot.LEAVE_AT)
        memoryManager.Delete(TrainSlot.LEAVE_AT_COUNT)

        memoryManager.Set(TrainSlot.LEAVE_AT, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

// This is a weird one, but it's training data
export const apiDontCareTrainPeople = {
    name: "dontcare-people",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PEOPLE, DONTCARE)

        memoryManager.Delete(TrainSlot.PEOPLE)
        memoryManager.Set(TrainSlot.PEOPLE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareAttractionType = {
    name: "dontcare-type",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.TYPE, DONTCARE)

        memoryManager.Delete(AttractionSlot.TYPE)
        memoryManager.Delete(AttractionSlot.TYPE_COUNT)

        memoryManager.Set(AttractionSlot.TYPE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelType = {
    name: "dontcare-type",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.TYPE, DONTCARE)

        memoryManager.Delete(HotelSlot.TYPE)
        memoryManager.Delete(HotelSlot.TYPE_COUNT)

        memoryManager.Set(HotelSlot.TYPE, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareRestaurantName = {
    name: "dontcare-name",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.NAME, DONTCARE)

        memoryManager.Delete(RestaurantSlot.NAME)
        memoryManager.Delete(RestaurantSlot.NAME_COUNT)

        memoryManager.Set(RestaurantSlot.NAME, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareAttractionName = {
    name: "dontcare-name",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.NAME, DONTCARE)

        memoryManager.Delete(AttractionSlot.NAME)
        memoryManager.Delete(AttractionSlot.NAME_COUNT)

        memoryManager.Set(AttractionSlot.NAME, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelName = {
    name: "dontcare-name",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.NAME, DONTCARE)

        memoryManager.Delete(HotelSlot.NAME)
        memoryManager.Delete(HotelSlot.NAME_COUNT)

        memoryManager.Set(HotelSlot.NAME, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelStars = {
    name: "dontcare-stars",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.STARS, DONTCARE)

        memoryManager.Delete(HotelSlot.STARS)
        memoryManager.Delete(HotelSlot.STARS_COUNT)

        memoryManager.Set(HotelSlot.STARS, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareHotelDay = {
    name: "dontcare-day",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.DAY, DONTCARE)

        memoryManager.Delete(HotelSlot.DAY)
        memoryManager.Delete(HotelSlot.DAY_COUNT)

        memoryManager.Set(HotelSlot.DAY, DONTCARE)

        DB.UpdateEntities(memoryManager)
    }
}

// A bit of a weird one to have day on restaurant but it's in the data
export const apiDontCareRestaurantDay = {
    name: "dontcare-day",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.DAY, DONTCARE)

        memoryManager.Delete(RestaurantSlot.DAY)

        memoryManager.Set(RestaurantSlot.DAY, DONTCARE)
        DB.UpdateEntities(memoryManager)
    }
}

export const apiDontCareRestaurantAddr = {
    name: "dontcare-addr",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(RestaurantSlot.DAY, DONTCARE)

        memoryManager.Delete(RestaurantSlot.ADDRESS)
        memoryManager.Delete(RestaurantSlot.ADDRESS_COUNT)

        memoryManager.Set(RestaurantSlot.ADDRESS, DONTCARE)
        DB.UpdateEntities(memoryManager)
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
        logicWithSet: async (memoryManager: ClientMemoryManager, setGlobalCallback: (globalCallbackValues: IGlobalCallbackValues[]) => Promise<void>, activityId: string, domainNameString: string) => {

            // Clear mention entities
            memoryManager.Delete('mention-police');
            memoryManager.Delete('mention-hospital');
            memoryManager.Delete('mention-taxi');
            memoryManager.Delete('mention-restaurant');
            memoryManager.Delete('mention-hotel');
            memoryManager.Delete('mention-train');
            
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

            let globalCallbackValues : IGlobalCallbackValues[] = []

            // Extract any globals
            const resultObj: string[][] = JSON.parse(result)
            const hotelName = resultObj.find(r => r[1] == "hotel" && r[2] == "name")
            if (hotelName) {
                globalCallbackValues.push({ entityName: 'global-hotel', entityValue: hotelName[3] })
            }
            const restaurantName = resultObj.find(r => r[1] == "restaurant" && r[2] == "name")
            if (restaurantName) {
                globalCallbackValues.push({ entityName: 'global-restaurant', entityValue: restaurantName[3] })
            }
            const attractionName = resultObj.find(r => r[1] == "attraction" && r[2] == "name")
            if (attractionName) {
                globalCallbackValues.push({ entityName: 'global-attraction', entityValue: attractionName[3] })
            }
            for (var ask of ASK_TYPES) 
            {
                if (resultObj.find(r => r[0] == "request" && r[2] == ask)) {
                    globalCallbackValues.push({ entityName: `global-ask-${ask}`, entityValue: "true" })
                }
                else {
                    globalCallbackValues.push({ entityName: `global-ask-${ask}`, entityValue: null })
                }
            }

            if (globalCallbackValues.length > 0) {
                await setGlobalCallback(globalCallbackValues);
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
        try {
            DB.UpdateEntities(memoryManager, domain)
        }
        catch (e) {
            console.log(e)
        }
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

            // Same entity should only last one turn
            memoryManager.Delete(`${domain}-same`);

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

            DB.ClearAsks(memoryManager, domain);
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
        domainDispatchModel.AddCallback(apiDontCareRestaurantArea)
        domainDispatchModel.AddCallback(apiDontCareRestaurantPrice)
        domainDispatchModel.AddCallback(apiDontCareRestaurantFood)
        domainDispatchModel.AddCallback(apiDontCareRestaurantName)
        domainDispatchModel.AddCallback(apiDontCareRestaurantDay)
        domainDispatchModel.AddCallback(apiDontCareRestaurantAddr)
    }
    else if (domain === "train") {
        domainDispatchModel.AddCallback(apiDontCareTrainArrive)
        domainDispatchModel.AddCallback(apiDontCareTrainLeave)
        domainDispatchModel.AddCallback(apiDontCareTrainPeople)
    }
    else if (domain === "hotel") {
        domainDispatchModel.AddCallback(apiDontCareHotelArea)
        domainDispatchModel.AddCallback(apiDontCareHotelPrice)
        domainDispatchModel.AddCallback(apiDontCareHotelType)
        domainDispatchModel.AddCallback(apiDontCareHotelName)
        domainDispatchModel.AddCallback(apiDontCareHotelStars)
        domainDispatchModel.AddCallback(apiDontCareHotelDay)
    }
    else if (domain === "taxi") {
        domainDispatchModel.AddCallback(apiDontCareTaxiArrive)
        domainDispatchModel.AddCallback(apiDontCareTaxiLeave)
    }
    else if (domain === "attraction") {
        domainDispatchModel.AddCallback(apiDontCareAttractionArea)
        domainDispatchModel.AddCallback(apiDontCareAttractionPrice)
        domainDispatchModel.AddCallback(apiDontCareAttractionType)
        domainDispatchModel.AddCallback(apiDontCareAttractionName)
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
export let clHospital: ConversationLearner
export let clPolice: ConversationLearner
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
        clHospital = getDomainDispatchCL(Domain.HOSPITAL, clFactory)
        clPolice = getDomainDispatchCL(Domain.POLICE, clFactory)

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