/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import * as express from 'express'
import * as BB from 'botbuilder'
import { ConversationLearnerFactory, FileStorage, uiRouter } from 'clwoz-sdk'
import chalk from 'chalk'
import config from './config'
import * as Models from './models'
import * as Test from './test'
import * as bodyParser from 'body-parser'
import { MakeUserActivity } from './utils'

console.log(`Config:\n`, JSON.stringify(config, null, '  '))

//===================
// Create Bot server
//===================
const server = express()
server.use(bodyParser.json())

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

Models.createModels(clFactory, modelId, clOptions.LUIS_AUTHORING_KEY)

// Serve default bot summary page. Should be customized by customer.
server.use(express.static(path.join(__dirname, '..', 'site')))

const testAdapter = new BB.TestAdapter(async (context) => {
    if (!context.activity.text.includes("::")) {
        var result = await Models.clDispatch.recognize(context)

        if (result) {
            return Models.clDispatch.SendResult(result)
        }
    }
})

server.post('/api/multiwoz', bodyParser.json(), async (req, res) => {

    if (!req.body) {
        res.sendStatus(400)
        return
    }
    const userInput = req.body.input
    const conversationId = req.body.id

    if (!userInput || !conversationId) {
        res.sendStatus(400)
        return
    }
    const userActivity = MakeUserActivity(userInput, conversationId)
    testAdapter.send(userActivity)

    var response = await Models.GetOutput(userActivity.id!)
    console.log(response)
    res.send(JSON.parse(response))
})

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {

        if (!Models.clDispatch) {
            await Models.createModels(clFactory, modelId, clOptions.LUIS_AUTHORING_KEY)
        }

        if (context.activity.text && context.activity.text.startsWith("::")) {
            if (context.activity.text === "::update") {
                await Models.createModels(clFactory, modelId, clOptions.LUIS_AUTHORING_KEY)
            }

            else if (context.activity.text === "::stop") {
                await Test.StopTesting(context)
            }

            else {
                await Test.RunTest(context)
            }

            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
        }

        // When running in training UI, ConversationLearner must always have control
        if (await Models.clRestaurant.InTrainingUI(context)) {
            let result = await Models.clRestaurant.recognize(context)
            if (result) {
                return Models.clRestaurant.SendResult(result)
            }
            return
        } else if (await Models.clDispatch.InTrainingUI(context)) {
            let result = await Models.clDispatch.recognize(context)
            if (result) {
                return Models.clDispatch.SendResult(result)
            }
            return
        }

        const result = await Models.clDispatch.recognize(context)

        if (result) {
            return Models.clDispatch.SendResult(result)
        }
    })
})

export default server
