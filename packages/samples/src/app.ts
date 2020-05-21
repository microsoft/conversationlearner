/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import * as express from 'express'
import * as BB from 'botbuilder'
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager, ReadOnlyClientMemoryManager, FileStorage, uiRouter } from '@conversationlearner/sdk'
import chalk from 'chalk'
import config from './config'
import { LuisSlot, Domain, DONTCARE, PICK_ONE } from './dataTypes'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as DB from './database'
import * as Utils from './utils'
import * as Combined from './combined'

console.log(`Config:\n`, JSON.stringify(config, null, '  '))

//===================
// Create Bot server
//===================
const server = express()

const { bfAppId, bfAppPassword, modelId, ...clOptions } = config

//==================
// Create Adapter
//==================
const adapter = new BB.BotFrameworkAdapter({ appId: bfAppId, appPassword: bfAppPassword })

//==================================
// Storage
//==================================
const fileStorage = new FileStorage(path.join(__dirname, 'storage'))

//==================================
// Initialize Conversation Learner
//==================================
const clFactory = new ConversationLearnerFactory(clOptions, fileStorage)

const includeSdk = ['development', 'test'].includes(process.env.NODE_ENV ?? '')
if (includeSdk) {
    console.log(chalk.cyanBright(`Adding /sdk routes`))
    server.use('/sdk', clFactory.sdkRouter)

    // Note: Must be mounted at root to use internal /ui paths
    console.log(chalk.greenBright(`Adding /ui routes`))
    server.use(uiRouter as any)
}

// Serve default bot summary page. Should be customized by customer.
server.use(express.static(path.join(__dirname, '..', 'site')))

let ActivityResultsQueue: DB.ActivityResult[] = []
let TestOutput = new Map<string, string>()

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

//=================================
// Initialize Models
//=================================
let clDispatch: ConversationLearner
const initDispatchModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("dispatch")
    clDispatch = clFactory.create(modelId)

    clDispatch.AddCallback({
        name: "Dispatch",
        logic: async (memoryManager: ClientMemoryManager, activityId: string, domainNameString: string) => {

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
            TestOutput.set(activityId, result)
            return result
        },
        render: async (result: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            return result
        }
    })
}

const getDomainDispatchCL = (domain: Domain): ConversationLearner => {

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
        Utils.ApplyEntitySubstitutions(memoryManager)
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

        }/*,
        render: async (result: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            return result
        }*/
    })

    //=== "Same" Callbacks ===
    Object.values(LuisSlot).forEach(entityName => {
        var slotName = slotMap.get(entityName)
        if (slotName) {
            domainDispatchModel.AddCallback({
                name: `same-${entityName}`,
                logic: async (memoryManager) => {
                    var price = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                    if (slotName) {
                        memoryManager.Set(slotName, price as string)
                    }
                }
            })
        }
    })

    //=== DontCare Callbacks ===
    domainDispatchModel.AddCallback(apiDontCareArea)
    domainDispatchModel.AddCallback(apiDontCarePrice)
    domainDispatchModel.AddCallback(apiDontCareFood)
    domainDispatchModel.AddCallback(apiDontCareArrive)
    domainDispatchModel.AddCallback(apiDontCareType)
    domainDispatchModel.AddCallback(apiDontCareName)

    return domainDispatchModel
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

const getDialogActCL = (dialogActName: string): ConversationLearner | null => {

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
                throw new Error(`Missing Activity ${activityId}`)
            }
            if (!activityResult?.modelResults.has(dialogActName)) {
                throw new Error(`Expected DialogAct ${dialogActName}`)
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
                return dialogActs.join(",")
            }
            // No action is possible to required entities
            else {
                activityResult.modelResults.delete(dialogActName)
                return ""
            }
        },
        render: async (result: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            return result
        }
    })
    return dialogActModel
}

let clAttraction: ConversationLearner
let clHotel: ConversationLearner
let clRestaurant: ConversationLearner
let clTaxi: ConversationLearner
let clTrain: ConversationLearner
const clDialogActsMap = new Map<string, ConversationLearner>()

const createModels = async () => {
    console.log('========= CREATING MODELS ==========')
    let cl = clFactory.create(modelId)
    const key = clOptions.LUIS_AUTHORING_KEY
    const hashedKey = key ? crypto.createHash('sha256').update(key).digest('hex') : ""
    const id = `MW-${hashedKey}`
    const query = `userId=${id}`
    const appList = await cl.clRunner.clClient.GetApps(query)

    ConversationLearnerFactory.setAppList(appList)

    Combined.initCombinedModel(clFactory)
    initDispatchModel()
    clAttraction = getDomainDispatchCL(Domain.ATTRACTION)
    clHotel = getDomainDispatchCL(Domain.HOTEL)
    clRestaurant = getDomainDispatchCL(Domain.RESTAURANT)
    clTaxi = getDomainDispatchCL(Domain.TAXI)
    clTrain = getDomainDispatchCL(Domain.TRAIN)

    var dacts = DB.DialogActs()
    for (var dialogAct of dacts) {
        var daModel = getDialogActCL(dialogAct)
        if (daModel) {
            clDialogActsMap.set(dialogAct, daModel)
        }
    }
}

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {

        if (!clDispatch) {
            await createModels()
        }

        if (context.activity.text && context.activity.text.startsWith("::")) {
            if (context.activity.text === "::update") {
                await createModels()
            }

            else if (context.activity.text === "::stop") {
                await StopTesting(context)
            }

            else {
                await RunTest(context)
            }

            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
        }

        // When running in training UI, ConversationLearner must always have control
        if (await clRestaurant.InTrainingUI(context)) {
            let result = await clRestaurant.recognize(context)
            if (result) {
                return clRestaurant.SendResult(result)
            }
            return
        } else if (await clDispatch.InTrainingUI(context)) {
            let result = await clDispatch.recognize(context)
            if (result) {
                return clDispatch.SendResult(result)
            }
            return
        }

        const result = await clDispatch.recognize(context)

        if (result) {
            return clDispatch.SendResult(result)
        }
    })
})

createModels()

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
                    if (curTime - startTime > 100000) {
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

                if (isDone && isTesting) {
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

var testOutputIntervals: NodeJS.Timeout[] = []
var getTestOutput = (activityId: string) => {
    var promise = new Promise<string>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                const output = TestOutput.get(activityId)
                if (!output) {
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 150000) {
                        var message = `Expire Output: ${activityId} ${curTime} ${startTime}`
                        console.log(message)
                        testOutputIntervals = testOutputIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                        resolve(message)
                    }
                    return
                }
                testOutputIntervals = testOutputIntervals.filter(i => i !== interval)
                clearInterval(interval)
                // Clear data
                TestOutput.delete(activityId)
                if (isTesting) {
                    resolve(output)
                }
            }
            , 1000)
        testOutputIntervals.push(interval)
    })
    return promise
}

const RunTest = async (context: BB.TurnContext) => {
    console.log('========= START TESTING ==========')

    var testDirectory = DB.GetDirectory(DB.TestDirectory)
    var transcriptFileNames = fs.readdirSync(testDirectory)

    // See if I filter to a single test
    var commands = context.activity.text.replace("::", "")
    if (commands) {
        transcriptFileNames = transcriptFileNames.filter(fn => fn.includes(commands))
    }

    if (transcriptFileNames.length === 0) {
        console.log(`--------- No Matching Dialogs ----------`)
    }
    isTesting = true
    for (var fileName of transcriptFileNames) {
        const transcript = fs.readFileSync(`${testDirectory}\\${fileName}`, 'utf-8')
        console.log(`--------- ${fileName} ----------`)
        await TestTranscript(JSON.parse(transcript), fileName)
        await clDispatch.EndSession(context)
        await clRestaurant.EndSession(context)
        await clAttraction.EndSession(context)
        await clTaxi.EndSession(context)
        await clTrain.EndSession(context)
        await clHotel.EndSession(context)
        if (!isTesting) {
            break
        }
    }

}

let isTesting = true
const StopTesting = async (context: BB.TurnContext) => {
    for (var interval of getActivityResultIntervals) {
        clearInterval(interval)
    }
    for (var interval of testOutputIntervals) {
        clearInterval(interval)
    }
    for (var activityResult of ActivityResultsQueue) {
        activityResult.modelResults = new Map<string, DB.DomainResult>()
    }

    await clDispatch.EndSession(context)
    await clRestaurant.EndSession(context)
    await clAttraction.EndSession(context)
    await clTaxi.EndSession(context)
    await clTrain.EndSession(context)
    await clHotel.EndSession(context)
    isTesting = false
    console.log('========= END TESTING ==========')
}

const TestTranscript = async (transcript: BB.Activity[], fileName: string) => {

    const adapter = new BB.TestAdapter(async (context) => {
        if (!context.activity.text.includes("::")) {
            var result = await clDispatch.recognize(context)

            if (result) {
                return clDispatch.SendResult(result)
            }
        }
    })

    var testResults: DB.TestResult[] = []
    // Need a new conversation ID 
    var conversationId = generateGUID()
    for (var i = 0; i < transcript.length; i = i + 2) {
        var userActivity = transcript[i]
        var agentActivity = transcript[i + 1]
        var error = ""
        if (userActivity.from.role !== BB.RoleTypes.User) {
            var message = `Unexpected agent turn ${i}`
            error += message
            console.log(message)
        }
        if (agentActivity.from.role !== BB.RoleTypes.Bot) {
            var message = `Unexpected user turn ${i}`
            error += message
            console.log(message)
        }
        else if (userActivity.from.role == BB.RoleTypes.User) {
            userActivity.id = generateGUID()
            userActivity.conversation.id = conversationId
            adapter.send(userActivity)

            // Log
            console.log(`${userActivity.text}`)
            console.log(`  ${agentActivity.text}`)
            var response = await getTestOutput(userActivity.id!)
            console.log(`  ${response}`)
            console.log(`  ${agentActivity.summary}`)
            console.log(`  -------------------------`)
            var testResult: DB.TestResult =
            {
                input: userActivity.text,
                expected: agentActivity.text,
                actual: response
            }
            if (error != "") {
                testResult.error = error
            }
            testResults.push(testResult)
        }

        if (!isTesting) {
            break
        }
    }
    console.log(`--------- DONE: ${fileName} ----------`)
    fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\${fileName}`, JSON.stringify(testResults))
}
/*
const makeActivity = (userInput: string) => {

    // LARS transcript name?
    const testId = generateGUID()

    const conversation: BB.ConversationAccount = {
        id: generateGUID(),
        isGroup: false,
        name: "",
        tenantId: "",
        aadObjectId: "",
        role: BB.RoleTypes.User,
        conversationType: ""
    }
    const fromAccount: BB.ChannelAccount = {
        name: "cltest", //Utils.CL_DEVELOPER,
        id: testId,
        role: BB.RoleTypes.User,
        aadObjectId: ''
    }

    const activity = {  //directline.Activity
        id: generateGUID(),
        conversation,
        type: BB.ActivityTypes.Message,
        text: userInput,
        from: fromAccount,
        channelData: { clData: { isValidationTest: true } }
    }

    return activity
}
*/


const generateGUID = (): string => {
    let d = new Date().getTime()
    let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        let r = ((d + Math.random() * 16) % 16) | 0
        d = Math.floor(d / 16)
        return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return guid
}


export default server
