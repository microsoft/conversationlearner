/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as BB from 'botbuilder'
import { CLDebug, DebugType } from '../CLDebug'
import InProcessMessageState from './InProcessMessageState'

// Delay after which we assume something went wrong in processing message
const MINUTE = 60000
const MESSAGE_TIMEOUT = MINUTE * 2

export interface QueuedInput {
    id: string  // conversationId + appId
    activityId: string
    timestamp: number
    callback: Function
}

/**
 * Used to queue up multiple user inputs when then come in a row so they can be handled sequentially
 */
export class InputQueue {

    // TODO: ADO 2412
    // In-memory store may result in out of order or dropped messages for a multi-host bot
    private static inputQueues: { [key: string]: QueuedInput[] } = {}

    private static MakeId(conversationId: string, appId: string = "none"): string {
        return `${conversationId}-${appId}`
    }

    public static ClearInputQueues() {
        this.inputQueues = {}
    }

    /**
     * 
     * @param inProcessMessageState Store for mutex
     * @param activity Input that needs to be handled
     * @param callback To be called when input is ready to be handled
     */
    public static async AddInput(inProcessMessageState: InProcessMessageState, activity: BB.Activity, appId: string | undefined, callback: Function): Promise<void> {
        if (!activity.id) {
            CLDebug.Error("InputQueue: Activity has no activityId")
            return
        }

        const id = InputQueue.MakeId(activity.conversation.id, appId)

        // Add to queue
        await InputQueue.InputQueueAdd(inProcessMessageState, id, activity.id, callback)

        // Process queue
        await InputQueue.InputQueueProcessNext(inProcessMessageState, id)
    }

    // Add input to queue
    private static async InputQueueAdd(inProcessMessageState: InProcessMessageState, id: string, activityId: string, callback: Function): Promise<void> {
        const now = new Date().getTime()
        const queuedInput: QueuedInput = {
            id,
            activityId,
            timestamp: now,
            callback,
        }

        if (!this.inputQueues[id]) {
            this.inputQueues[id] = []
        }
        this.inputQueues[id].push(queuedInput)
        this.log(`ADD QUEUE`, id, queuedInput.activityId, inProcessMessageState)
    }

    private static hasExpired(queuedInput: QueuedInput): boolean {
        const now = new Date().getTime()
        const age = now - queuedInput.timestamp
        return (age > MESSAGE_TIMEOUT)
    }

    // Process next input
    private static async InputQueueProcessNext(inProcessMessageState: InProcessMessageState, id: string): Promise<void> {

        // Get current input being processed (mutex)
        let inputInProcess = await inProcessMessageState.get<QueuedInput>()

        this.log(`CHECK    `, id, inputInProcess ? inputInProcess.activityId.substr(0, 4): "_GO_", inProcessMessageState)

        // If input is being processed (mutex is set), check if it has expired
        if (inputInProcess) {
            if (this.hasExpired(inputInProcess)) {
                // Item in mutex has expired
                this.log(`EXPIRED U`, id, inputInProcess.activityId, inProcessMessageState)

                // Clear the input mutex
                await inProcessMessageState.remove()

                // Process the next input
                await InputQueue.InputQueueProcessNext(inProcessMessageState, id)
            }
        }
        // Otherwise process the next one
        else if (this.inputQueues[id]) {
            const inputToProcess = this.inputQueues[id].shift()

            if (inputToProcess) {
                // Skip to the next if it has expired
                if (this.hasExpired(inputToProcess)) {
                    // Item in queue has expired
                    this.log(`EXPIRED Q`, id, inputToProcess.activityId, inProcessMessageState)

                    // Call the callback with failure
                    inputToProcess.callback(false, inputToProcess.activityId)

                    // Process the next input
                    await InputQueue.InputQueueProcessNext(inProcessMessageState, id)
                }
                else {
                    // Set the input currently being processed (mutex)
                    await inProcessMessageState.set(inputToProcess)

                    // Fire the callback with success to start processing
                    this.log(`CALLBACK `, id, inputToProcess.activityId, inProcessMessageState)
                    inputToProcess.callback(false, inputToProcess.activityId)
                }
            }
            else {
                // Queue is empty
                this.log(`FIN QUEUE`, id, "", inProcessMessageState)
                delete this.inputQueues[id]
            }
        }
    }

    // To be called when an input is done being processeed
    public static async MessageHandled(inProcessMessageState: InProcessMessageState, conversationId: string, appId: string | undefined, activity?: BB.Activity): Promise<void> {

        const id = InputQueue.MakeId(conversationId, appId)

        // Remove mutex
        let processedInput = await inProcessMessageState.remove<QueuedInput>()

        // When response is pre-empted by an error message, no activity will be passed
        if (!activity) {
            CLDebug.Log(`HANDLE-PREEMPTIVE`, DebugType.MessageQueue)
        }
        else if (!processedInput) {
            // Handle called when no input being processed
            this.log(`NO  MUTEX`, id, activity.id, inProcessMessageState)
        }
        else if (processedInput.activityId !== activity.id) {
            CLDebug.Error("Input Queue: Handle called for different input than one being processed")
        }
        else {
            this.log(`HANDLED  `, id, processedInput.activityId, inProcessMessageState)
        }

        // Process next input in the queue
        await InputQueue.InputQueueProcessNext(inProcessMessageState, id)
    }

    private static log(prefix: string, id: string, activityId?: string, inProcessMessageState: InProcessMessageState | null = null): void {
        const queue = this.inputQueues[id] ? this.inputQueues[id].map(qi => qi.activityId.substr(0, 4)).join(" ") : "---"
        const activityText = activityId ? activityId.substr(0, 4) : "----"
        const key = inProcessMessageState ? inProcessMessageState.getKey() : "----"
        const debugString = `${prefix}| K: ${key/*.substr(0, 4)*/} C: ${id.substr(id.length - 5)} A: ${activityText} Q: ${queue}`
        CLDebug.Log(debugString, DebugType.MessageQueue)
    }
}

