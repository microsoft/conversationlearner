/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as BB from 'botbuilder'
import { ActivityLog } from './dataTypes'
import * as fs from 'fs'
import * as DB from './database'
import * as Models from './models'
import * as Utils from './utils'
import { Goal } from './dataTypes'

// Assumes only one test is run concurrently
export let TestGoal: Goal | undefined

var testCountMismatch = 0
var testTotalCount = 0
var testItemMismatch = 0
var testTotalItem = 0
var testValueMismatch = 0
export const RunTest = async (context: BB.TurnContext) => {
    console.log('========= START TESTING ==========')

    testCountMismatch = 0
    testTotalCount = 0
    testItemMismatch = 0
    testTotalItem = 0
    testValueMismatch = 0

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
    var itemCount = 0;
    for (var fileName of transcriptFileNames) {
        const transcript = fs.readFileSync(`${testDirectory}\\${fileName}`, 'utf-8')
        console.log(`--------- ${fileName} ----------`)
        await TestTranscript(JSON.parse(transcript), fileName)
        await Models.clDispatch.EndSession(context)
        await Models.clRestaurant.EndSession(context)
        await Models.clAttraction.EndSession(context)
        await Models.clTaxi.EndSession(context)
        await Models.clTrain.EndSession(context)
        await Models.clHotel.EndSession(context)
        itemCount++
        WriteResults(itemCount);
        if (!isTesting) {
            break
        }
    }
}

let isTesting = false
export const StopTesting = async (context: BB.TurnContext) => {
    Models.StopActivity()
    TestGoal = undefined
    await Models.clDispatch.EndSession(context)
    await Models.clRestaurant.EndSession(context)
    await Models.clAttraction.EndSession(context)
    await Models.clTaxi.EndSession(context)
    await Models.clTrain.EndSession(context)
    await Models.clHotel.EndSession(context)

    isTesting = false
    console.log('========= END TESTING ==========')
}


export class TestResult {
    public input?: string
    public output?: string
    public expect: string[][] = []
    public expectRaw: string = ""
    public actual: string[][] = []
    public actualRaw: string = ""
    public error?: string = undefined

    static ToPrint(testResults: TestResult[]): string {
        return JSON.stringify(testResults.map(tr => 
            {
                delete tr.actual
                delete tr.expect
                return tr
            }
        ))
    }

    constructor(input: string, error?: string) {
        this.input = input;
        this.error = error;
    }

    public SetExpect(expectRaw: string) {
        this.expect = this.SortResult(expectRaw)
        this.expectRaw = JSON.stringify(this.expect)
    }

    public SetActual(actualRaw: string) {
        if (actualRaw.indexOf("Expire") >= 0) {
            this.error = actualRaw;
            this.actual = []
        }
        else {
            this.actual = this.SortResult(actualRaw)
        }
        this.actualRaw = JSON.stringify(this.actual)
    }

    public SortResult(resultText: string): string[][] {
        var result: string[][] = JSON.parse(resultText)
        return result.sort((a: string[], b: string[]): number => {
            if (a[0] < b[0]) {
                return -1
            }
            else if (a[0] > b[0]) {
                return 1
            }
            else if (a[1] < b[1]) {
                return -1
            }
            else if (a[1] > b[1]) {
                return 1;
            }
            else if (a[2] < b[2]) {
                return -1
            }
            else if (a[2] > b[2]) {
                return 1
            }
            else {
                return 0
            }
        })
    }
}

const TestTranscript = async (activityLog: ActivityLog, fileName: string) => {

    const adapter = new BB.TestAdapter(async (context) => {
        if (!context.activity.text.includes("::")) {
            var result = await Models.clDispatch.recognize(context)

            if (result) {
                return Models.clDispatch.SendResult(result)
            }
        }
    })

    var testResults: TestResult[] = []
    // Need a new conversation ID 
    var conversationId = Utils.GenerateGUID()

    // Add goals to map so can impliment DB fail cases
    TestGoal = activityLog.goal

    for (var i = 0; i < activityLog.activities.length; i = i + 2) {
        var userActivity = activityLog.activities[i]
        var agentActivity = activityLog.activities[i + 1]
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
            userActivity.id = Utils.GenerateGUID()
            userActivity.conversation.id = conversationId
            adapter.send(userActivity)

            // Log
            console.log(`${userActivity.text}`)

            var testResult = new TestResult(userActivity.text)
            testResult.SetExpect(agentActivity.text);
            console.log(`  ${testResult.expectRaw}`)

            var response = await Models.GetOutput(userActivity.id!)

            testResult.SetActual(response)
            testResult.output = agentActivity.summary

            console.log(`  ${testResult.actualRaw}`)
            console.log(`  ${agentActivity.summary}`)
            console.log(`  -------------------------`)

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
    TestGoal = undefined
    SaveTestResult(fileName, testResults)
}

const SaveTestResult = async (fileName: string, testResults: TestResult[]) => {
    var countMismatch = 0
    var totalCount = 0
    var itemMismatch = 0
    var totalItem = 0
    var valueMismatch = 0
    var expired = false;
    
    for (var testResult of testResults) {
        if (testResult.error) {
            expired = true;
            break;
        }

        totalCount++;
        if (testResult.expect.length != testResult.actual.length) {
            countMismatch++
        }

        for (var expectedItem of testResult.expect) 
        {
            totalItem++;
            var actualItem = testResult.actual.find(a => a[0] == expectedItem[0] && a[1] == expectedItem[1] && a[2] == expectedItem[2])
            if (!actualItem) {
                itemMismatch++
            }
            else {
                var domain = expectedItem[1]
                var entity = expectedItem[2]
                var actualValue = CleanValue(actualItem[3], entity, domain)
                var expectedValue = CleanValue(expectedItem[3], entity, domain)
                if (actualValue != expectedValue) {
                    valueMismatch++
                }
            }
        }
    }
    testCountMismatch += countMismatch
    testTotalCount += totalCount
    testItemMismatch += itemMismatch
    testTotalItem += totalItem
    testValueMismatch += valueMismatch

    if (expired) {
        var saveName = `EXPIRED  ${fileName}`
        fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\${saveName}`, TestResult.ToPrint(testResults))
    }
    else {
        var percentCount = zeroPad(Math.round(100 * countMismatch/totalCount))
        var percentItem = zeroPad(Math.round(100 * itemMismatch/totalItem))
        var percentValue = zeroPad(Math.round(100 * valueMismatch/totalItem))
        var saveName = `${percentCount}-${percentItem}-${percentValue}  ${fileName}`
        fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\${saveName}`, TestResult.ToPrint(testResults))
    }
}

const CleanValue = (text: string, entity: string, domain: string) => {
    const lower = text.toLowerCase()
    const substitution = DB.EntitySubstitutions()[lower]
    if (substitution) {
        return substitution
    }
    return DB.ResolveEntityValue(lower, entity, domain)
}

const WriteResults = (itemCount: number) => {

    var percentCount = zeroPad(Math.round(100 * testCountMismatch/testTotalCount))
    var percentItem = zeroPad(Math.round(100 * testItemMismatch/testTotalItem))
    var percentValue = zeroPad(Math.round(100 * testValueMismatch/testTotalItem))
    var saveName = `_ ${percentCount}-${percentItem}-${percentValue} / ${itemCount}`
    fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\_RESULTS`, saveName)
}
const zeroPad = (num: number) => String(num).padStart(2, '0')

