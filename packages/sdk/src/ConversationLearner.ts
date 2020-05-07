/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as BB from 'botbuilder'
import { CLRunner, EntityDetectionCallback, OnSessionStartCallback, OnSessionEndCallback, ICallbackInput } from './CLRunner'
import { CLClient } from './CLClient'
import { CLRecognizerResult } from './CLRecognizeResult'
import CLStateFactory from './Memory/CLStateFactory'
import { CLOptions } from './CLOptions'
import { CLModelOptions } from './CLModelOptions'
import { ILogStorage } from './Memory/ILogStorage'

/**
 * Main CL class used by Bot
 */
export class ConversationLearner {
    public static models: ConversationLearner[] = []
    public clRunner: CLRunner
    private stateFactory: CLStateFactory

    constructor(
        stateFactory: CLStateFactory,
        client: CLClient,
        options: CLOptions,
        modelId: string | undefined,
        modelOptions?: CLModelOptions,
        logStorage?: ILogStorage,
    ) {
        this.stateFactory = stateFactory
        this.clRunner = CLRunner.Create(stateFactory, client, options, modelId, logStorage, modelOptions)
        ConversationLearner.models.push(this)
    }

    public async recognize(turnContext: BB.TurnContext, force?: boolean): Promise<CLRecognizerResult | null> {
        // tslint:disable-next-line:no-this-assignment
        let activeModel: ConversationLearner = this
        // If there is more than one model in use for running bot we need to check which model is active for conversation
        // This check avoids doing work for normal singe model model bots
        if (ConversationLearner.models.length > 1) {
            const context = this.stateFactory.getFromContext(turnContext)
            const activeModelIdForConversation = await context.ConversationModelState.get<string>()
            const model = ConversationLearner.models.find(m => m.clRunner.modelId === activeModelIdForConversation)
            if (model) {
                activeModel = model
            }
        }

        const result = await activeModel.clRunner.recognize(turnContext, force)

        return result
    }

    /**
     * OPTIONAL: Sessions are started automatically, StartSession call is only needed if bot needs
     * to start Conversation Learner Session with initial entity values.
     * Results in clearing of existing Entity values, and a call to the OnSessionStartCallback
     * @param turnContext BotBuilder Context
     */
    public async StartSession(turnContext: BB.TurnContext): Promise<void> {
        await this.clRunner.BotStartSession(turnContext)
    }

    /**
     * OPTIONAL: 
     * Results in clearing of existing Entity values, and a call to the OnSessionEndCallback
     * @param turnContext BotBuilder Context
     */
    public async EndSession(turnContext: BB.TurnContext): Promise<void> {
        await this.clRunner.BotEndSession(turnContext)
    }

    /**
     * Provide an callback that will be invoked whenever a Session is started
     * @param target Callback of the form (context: BB.TurnContext, memoryManager: ClientMemoryManager) => Promise<void>
     */
    set OnSessionStartCallback(target: OnSessionStartCallback) {
        this.clRunner.onSessionStartCallback = target
    }

    /**
     * Provide a callback that will be invoked whenever a Session ends.  Sessions
     * can end because of a timeout or the selection of an EndSession activity
     * @param target Callback of the form (context: BB.TurnContext, memoryManager: ClientMemoryManager, sessionEndState: CLM.SessionEndState, data: string | undefined) => Promise<string[] | undefined>
     */
    set OnSessionEndCallback(target: OnSessionEndCallback) {
        this.clRunner.onSessionEndCallback = target
    }

    public async SendResult(result: CLRecognizerResult): Promise<void> {
        await this.clRunner.SendResult(result)
    }

    /** Returns true is bot is running in the Training UI
     * @param turnContext BotBuilder Context
     */
    public async InTrainingUI(turnContext: BB.TurnContext): Promise<boolean> {
        // TODO: This always returns false for onConversationUpdate as 'from' is not set
        return await this.clRunner.InTrainingUI(turnContext)
    }

    /**
     * Define an API callback that can be used by the Model
     * @param callback Object with callback name, optional logic function, and optional render function.
     */
    public AddCallback<T>(callback: ICallbackInput<T>) {
        this.clRunner.AddCallback(callback)
    }

    /**
     * Define an Callback that will be called after Entity Detection
     * @param target Callback of the form (text: string, memoryManager: ClientMemoryManager) => Promise<void>
     */
    set EntityDetectionCallback(target: EntityDetectionCallback) {
        this.clRunner.entityDetectionCallback = target
    }
}
