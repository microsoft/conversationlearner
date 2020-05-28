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
export let TestGoal: Goal

export const RunTest = async (context: BB.TurnContext) => {
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

export let isTesting = true
export const StopTesting = async (context: BB.TurnContext) => {
    Models.StopActivity()

    await Models.clDispatch.EndSession(context)
    await Models.clRestaurant.EndSession(context)
    await Models.clAttraction.EndSession(context)
    await Models.clTaxi.EndSession(context)
    await Models.clTrain.EndSession(context)
    await Models.clHotel.EndSession(context)

    isTesting = false
    console.log('========= END TESTING ==========')
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

    var testResults: DB.TestResult[] = []
    // Need a new conversation ID 
    var conversationId = Utils.generateGUID()

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
            userActivity.id = Utils.generateGUID()
            userActivity.conversation.id = conversationId
            adapter.send(userActivity)

            // Log
            console.log(`${userActivity.text}`)
            console.log(`  ${agentActivity.text}`)
            var response = await Models.getTestOutput(userActivity.id!)
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
