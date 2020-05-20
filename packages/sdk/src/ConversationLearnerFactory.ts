/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as BB from 'botbuilder'
import * as express from 'express'
import { ConversationLearner } from './ConversationLearner'
import { CLOptions } from './CLOptions'
import { CLClient } from './CLClient'
import getRouter from './http/router'
import CLStateFactory from './Memory/CLStateFactory'
import { ILogStorage } from './Memory/ILogStorage'
import { CLModelOptions } from './CLModelOptions'
import * as CLM from '@conversationlearner/models'

/**
 * Conversation Learner Factory. Produces instances that all use the same storage, client, and options.
 * Alternative which ConversationLearner.Init() which set the statics but this created temporal coupling (need to call Init before constructor)
 */
export default class ConversationLearnerFactory {
    private storageFactory: CLStateFactory
    private client: CLClient
    private logStorage: ILogStorage | undefined
    private options: CLOptions
    public static AppsList: CLM.AppList

    sdkRouter: express.Router

    constructor(
        options: CLOptions,
        bbStorage: BB.Storage = new BB.MemoryStorage(),
        logStorage?: ILogStorage,
    ) {
        this.storageFactory = new CLStateFactory(bbStorage)
        this.logStorage = logStorage
        this.options = options
        this.client = new CLClient(options)

        this.sdkRouter = getRouter(this.client, this.storageFactory, options, logStorage)
    }

    create(modelId?: string, modelOptions?: CLModelOptions) {
        return new ConversationLearner(
            this.storageFactory,
            this.client,
            this.options,
            modelId,
            modelOptions,
            this.logStorage
        )
    }

    static modelIdFromName(appName: string): string | undefined {
        if (!ConversationLearnerFactory.AppsList) {
            return undefined;
        }
        else {
            return ConversationLearnerFactory.AppsList.apps.find(a => a.appName.toLowerCase() === appName.toLowerCase())?.appId
        }
    }

    static setAppList(appsList: CLM.AppList) {
        ConversationLearnerFactory.AppsList = appsList
    }
}
