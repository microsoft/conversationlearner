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
import { LuisSlot, Domain, DONTCARE, OUTPUT } from './dataTypes'
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


let ActivityResults: DB.ActivityResult[] = []
let TestOutput = new Map<string, string>()

//=================================
// Add Entity Logic
//=================================

//=================================
// Output
//=================================
export const apiAddOutput = {
    name: "AddOutput",
    logic: async (memoryManager: ClientMemoryManager, intent: string) => {
        memoryManager.Set(OUTPUT, intent)
    }
}

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
        logic: async (memoryManager: ClientMemoryManager, activityId: string, domainString: string) => {

            var domain = domainString as Domain
            var result = ActivityResults.find(r => r.activityId === activityId)
            if (!result) {
                result = {
                    activityId,
                    creationTime: new Date().getTime(),
                    domainResults: new Map<Domain, DB.DomainResult>()
                }
                ActivityResults.push(result)
            }
            // Add empty entry for this domain
            result.domainResults.set(domain, null)
        }
    })

    clDispatch.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId) => {
            const activityResult = await getActivityResult(activityId)
            const result = ActivityResultToString(activityResult)
            TestOutput.set(activityId, result)
            return result
        },
        render: async (activityResult: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            return activityResult
        }
    })
}

const ActivityResultToString = (activityResult: DB.ActivityResult): string => {
    let dialogActs: string[] = []
    let entities: string[] = []
    let output: string[][] = []
    activityResult.domainResults.forEach(dr => {
        if (dr) {
            dialogActs = [...dialogActs, ...dr.dialogActs]
            entities = [...entities, ...dr.entities]
            output = output.concat(dr.output)
        }
    })
    //return `${dialogActs.join(",")} ${entities.join(",")}`
    return JSON.stringify(output)
}

const makeId = (length: number): string => {
    var result = ''
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    var charactersLength = characters.length
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

const expandedResults = (dialogActs: string[], entities: string[]): string[][] => {
    const results: string[][] = []
    for (var dialogAct of dialogActs) {
        var parts = dialogAct.split('-')
        const domain = parts[0]
        const act = parts[1]
        const entity = parts[2]

        if (act == "Request") {
            results.push([act, domain, entity, "?"])
        }
        else if (entity == "none") {
            results.push([act, domain, entity, "none"])
        }
        else if (entity == "Ref") {
            results.push([act, domain, entity, makeId(8)])
        }
        else {
            const kv = entities.find(e => e.includes(entity.toLowerCase()))
            // "attraction-semi-area: east,centre,south,west,north"
            const values = kv ? kv.split(": ")[1].split(",") : ["MISSING"]
            for (var value of values) {
                results.push([act, domain, entity, value])
            }
        }
    }
    return results
}
const getDomainCL = (domain: Domain): ConversationLearner => {

    const modelId = ConversationLearnerFactory.modelIdFromName(domain)
    const model = clFactory.create(modelId)

    var slotNames = Utils.getSlotNames(domain)
    const slotMap = new Map()
    slotNames.forEach((entityName: string) => {
        return slotMap.set(Utils.shortName(entityName), entityName)
    })

    model.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        Utils.ApplyEntitySubstitutions(memoryManager)
        DB.UpdateEntities(memoryManager, domain)
    }

    model.AddCallback(apiAddOutput)

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {

            const activityResult = ActivityResults.find(ar => ar.activityId === activityId)
            if (!activityId) {
                throw new Error(`Missing Activity ${activityId}`)
            }
            if (!activityResult?.domainResults.has(domain)) {
                throw new Error(`Expected Domain ${domain}`)
            }
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = DB.getEntities(domain, memoryManager)
            const output = expandedResults(dialogActs, entities)

            const result: DB.DomainResult = {
                dialogActs,
                entities,
                output
            }
            activityResult.domainResults.set(domain, result)
            memoryManager.Delete(OUTPUT)
            return
        }
    })

    //=== "Same" Callbacks ===
    Object.values(LuisSlot).forEach(entityName => {
        var slotName = slotMap.get(entityName)
        if (slotName) {
            model.AddCallback({
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
    model.AddCallback(apiDontCareArea)
    model.AddCallback(apiDontCarePrice)
    model.AddCallback(apiDontCareFood)
    model.AddCallback(apiDontCareArrive)
    model.AddCallback(apiDontCareType)
    model.AddCallback(apiDontCareName)

    return model
}

let clAttraction: ConversationLearner
let clHotel: ConversationLearner
let clRestaurant: ConversationLearner
let clTaxi: ConversationLearner
let clTrain: ConversationLearner

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
    clAttraction = getDomainCL(Domain.ATTRACTION)
    clHotel = getDomainCL(Domain.HOTEL)
    clRestaurant = getDomainCL(Domain.RESTAURANT)
    clTaxi = getDomainCL(Domain.TAXI)
    clTrain = getDomainCL(Domain.TRAIN)
}

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {

        if (!clDispatch) {
            await createModels()
        }

        if (context.activity.text === "update models") {
            await createModels()
            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
            return
        }

        if (context.activity.text && context.activity.text.includes("test")) {
            await RunTest(context)
            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
        }

        if (context.activity.text === "stop") {
            await StopTesting(context)
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
var getActivityResult = (activityId: string) => {
    var promise = new Promise<DB.ActivityResult>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                var activityResult = ActivityResults.find(r => r.activityId === activityId)
                if (!activityResult) {
                    console.log(`Expected activity result ${activityId}`)
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 100000) {
                        console.log(`Expire Activity: ${activityId} ${curTime} ${startTime}`)
                        getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                    }
                    return
                }
                // LARS check for timeout
                var isDone = true
                activityResult.domainResults.forEach((value: DB.DomainResult | null, key: string) => {
                    if (value == null) {
                        isDone = false
                    }
                })

                if (isDone && isTesting) {
                    getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                    clearInterval(interval)
                    // Clear data
                    ActivityResults = ActivityResults.filter(r => r.activityId !== activityId)
                    resolve(activityResult)
                }
            }
            , 1000)
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
    var commands = context.activity.text.split(" ")
    if (commands[1]) {
        transcriptFileNames = transcriptFileNames.filter(fn => fn.includes(commands[1]))
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
        if (context.activity.text != "test") {
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
            console.log(`${userActivity.text}`)
            console.log(`${agentActivity.summary}`)
            console.log(`  ${agentActivity.text}`)
            var response = await getTestOutput(userActivity.id!)
            console.log(`< ${response}`)

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
