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

const TestDirectory = 'test_transcripts'
const ResultsDirectory = 'test_results'

export class TestResult {

    public static testCountMismatch = 0
    public static testNameMismatch = 0
    public static testTotalCount = 0
    public static testItemMismatch = 0
    public static testTotalItem = 0
    public static testValueMismatch = 0
    public static testResults : TestResult[] = []

    public fileName: string
    public turnResults: TurnResult[] = []

    public countMismatch = 0;
    public nameMismatch = 0;
    public totalCount: number = 0

    public itemMismatch: number = 0
    public valueMismatch: number = 0
    public totalItem: number = 0

    public expired = false;
    public missingDA = false;
    // % of turns that have different number of dialog acts
    public percentCount: string = ""

    // % of turns that have different number of selected items from DB
    public percentName: string = ""

    // % of dialogs acts that are different in a turn
    public percentItem: string = ""

    // % of dialogs acts that have different values
    public percentValue: string = ""

    public constructor(fileName: string) {
        this.fileName = TestResult.ShortName(fileName)
        TestResult.testResults.push(this)
    }

    public static StartTestRun() {
        this.testCountMismatch = 0
        this.testNameMismatch = 0
        this.testTotalCount = 0
        this.testItemMismatch = 0
        this.testTotalItem = 0
        this.testValueMismatch = 0
        this.testResults = []
    }

    private CalculateResults() {
        this.countMismatch = 0
        this.nameMismatch = 0
        this.totalCount = 0
        this.itemMismatch = 0
        this.totalItem = 0
        this.valueMismatch = 0
        this.expired = false;
        this.missingDA = false;

        for (var testResult of this.turnResults) {
            if (testResult.error) {
                this.expired = true
                break
            }
    
            this.totalCount++;
            if (testResult.expect.length != testResult.actual.length) {
                this.countMismatch++
            }
            if (testResult.expect.length == 0) {
                this.missingDA = true;
            }

            var expectedNameCount = testResult.expect.filter(e => e[2] == "name")?.length
            var actualNameCount = testResult.actual.filter(e => e[2] == "name")?.length
            if (expectedNameCount != actualNameCount) {
                this.nameMismatch++;
            }
    
            for (var expectedItem of testResult.expect) 
            {
                this.totalItem++;
                var actualItem = testResult.actual.find(a => a[0] == expectedItem[0] && a[1] == expectedItem[1] && a[2] == expectedItem[2])
                if (!actualItem) {
                    this.itemMismatch++
                }
                else {
                    var domain = expectedItem[1]
                    var entity = expectedItem[2]
                    var actualValue = TestResult.CleanValue(actualItem[3], entity, domain)
                    var expectedValue = TestResult.CleanValue(expectedItem[3], entity, domain)
                    if (actualValue != expectedValue) {
                        this.valueMismatch++
                    }
                }
            }
        }
        TestResult.testCountMismatch += this.countMismatch
        TestResult.testNameMismatch += this.nameMismatch
        TestResult.testTotalCount += this.totalCount
        TestResult.testItemMismatch += this.itemMismatch
        TestResult.testTotalItem += this.totalItem
        TestResult.testValueMismatch += this.valueMismatch

        this.percentName = TestResult.ZeroPad(Math.round(100 * this.nameMismatch/this.totalCount))
        this.percentCount = TestResult.ZeroPad(Math.round(100 * this.countMismatch/this.totalCount))
        this.percentItem = TestResult.ZeroPad(Math.round(100 * this.itemMismatch/this.totalItem))
        this.percentValue = TestResult.ZeroPad(Math.round(100 * this.valueMismatch/this.totalItem))
    }
 
    public static ShortName(fileName: string): string 
    {
        return fileName.trimLeft().substring(0, fileName.length - 5);
    }

    public SaveName(): string {
        if (this.expired) {
            return `${this.fileName} EXPIRED  ` 
        }
        else if (this.missingDA) {
            return `${this.fileName}  ${this.percentName} ${this.percentCount} ${this.percentItem} ${this.percentValue}  (DA)`
        }
        else {
            return `${this.fileName}  ${this.percentName} ${this.percentCount} ${this.percentItem} ${this.percentValue}  `
        }
    }

    public SaveResult() {
        this.CalculateResults()

        fs.writeFileSync(`${DB.GetDirectory(ResultsDirectory)}\\${this.SaveName()}.json`, TurnResult.ToPrint(this.turnResults))

        // Update overall summary
        TestResult.SaveRunResults()
    }

    private static CleanValue(text: string, entity: string, domain: string) {
        const lower = text.toLowerCase()
        const substitution = DB.EntitySubstitutions()[lower]
        if (substitution) {
            return substitution
        }
        return DB.ResolveEntityValue(lower, entity, domain)
    }
    
    private static ZeroPad(num: number) { 
        return String(num).padStart(2, '0') 
    }
    
    private static SaveRunResults() {
        var percentName = this.ZeroPad(Math.round(100 * this.testNameMismatch/this.testTotalCount))
        var percentCount = this.ZeroPad(Math.round(100 * this.testCountMismatch/this.testTotalCount))
        var percentItem = this.ZeroPad(Math.round(100 * this.testItemMismatch/this.testTotalItem))
        var percentValue = this.ZeroPad(Math.round(100 * this.testValueMismatch/this.testTotalItem))
        var summary = `${percentName}-${percentCount}-${percentItem}-${percentValue} / ${this.testResults.length}\n`
        summary += `=========================================\n`
        for (var testResult of this.testResults) {
            summary += `${testResult.SaveName()}\n`
        }
        fs.writeFileSync(`${DB.GetDirectory(ResultsDirectory)}\\_TOTALS_.txt`, summary)
    }
}

export const RunTest = async (context: BB.TurnContext) => {
    console.log('========= START TESTING ==========')

    TestResult.StartTestRun()

    var testDirectory = DB.GetDirectory(TestDirectory)
    var transcriptFileNames = fs.readdirSync(testDirectory)

    // See if I filter to a single test. If so alwasy test even if have results
    var retest = true;// LARS TEMP
    var commands = context.activity.text.replace("::", "")
    if (commands) {
        transcriptFileNames = transcriptFileNames.filter(fn => fn.includes(commands))
        retest = true;
    }

    if (transcriptFileNames.length === 0) {
        console.log(`--------- No Matching Dialogs ----------`)
    }
    isTesting = true

    // Get list of test already existing
    var existingFiles = fs.readdirSync(ResultsDirectory);
    
    for (var fileName of transcriptFileNames) {
        var shortName = TestResult.ShortName(fileName);
        // If file already exist.  Only re-test if fixed
        var existingFile = existingFiles.find(ef => ef.indexOf(shortName) >= 0 )
        if (!retest && existingFile && existingFile.indexOf("fixed") == -1 && existingFile.indexOf("EXPIRED") == -1) {
            console.log(`--------- SKIP ${fileName} ----------`)
            continue;
        }
        const transcript = fs.readFileSync(`${testDirectory}\\${fileName}`, 'utf-8')
        console.log(`--------- ${fileName} ----------`)
        await TestTranscript(JSON.parse(transcript), fileName)
        await Models.clDispatch.EndSession(context)
        await Models.clRestaurant.EndSession(context)
        await Models.clAttraction.EndSession(context)
        await Models.clTaxi.EndSession(context)
        await Models.clTrain.EndSession(context)
        await Models.clHotel.EndSession(context)
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


export class TurnResult {
    public input?: string
    public output?: string
    public expect: string[][] = []
    public expectRaw: string = ""
    public actual: string[][] = []
    public actualRaw: string = ""
    public error?: string = undefined

    static ToPrint(testResults: TurnResult[]): string {
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

    var testResult = new TestResult(fileName)
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

            var turnResult = new TurnResult(userActivity.text)
            turnResult.SetExpect(agentActivity.text);
            console.log(`  ${turnResult.expectRaw}`)

            var response = await Models.GetOutput(userActivity.id!)

            turnResult.SetActual(response)
            turnResult.output = agentActivity.summary

            console.log(`  ${turnResult.actualRaw}`)
            console.log(`  ${agentActivity.summary}`)
            console.log(`  -------------------------`)

            if (error != "") {
                turnResult.error = error
            }
            testResult.turnResults.push(turnResult)
        }

        if (!isTesting) {
            break
        }
    }
    console.log(`--------- DONE: ${fileName} ----------`)
    TestGoal = undefined
    testResult.SaveResult()
}
/*
const SaveTestResult = async (fileName: string, testResult: TestResult) => {
    var countMismatch = 0
    var totalCount = 0
    var itemMismatch = 0
    var totalItem = 0
    var valueMismatch = 0
    var expired = false;
    
    for (var testResult of turnResults) {
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
        fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\${saveName}`, TurnResult.ToPrint(turnResults))
    }
    else {
        var percentCount = zeroPad(Math.round(100 * countMismatch/totalCount))
        var percentItem = zeroPad(Math.round(100 * itemMismatch/totalItem))
        var percentValue = zeroPad(Math.round(100 * valueMismatch/totalItem))
        var saveName = `${percentCount}-${percentItem}-${percentValue}  ${fileName}`
        fs.writeFileSync(`${DB.GetDirectory(DB.ResultsDirectory)}\\${saveName}`, TurnResult.ToPrint(turnResults))
    }
}
*/

