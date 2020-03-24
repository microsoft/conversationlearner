/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { MemoryValue } from './Memory'
import { FilledEntity } from './FilledEntity'
import { ModelUtils } from './ModelUtils'
import { ScoreInput, ScoreResponse, ScoredAction, UnscoredAction, ScoredBase } from './Score'
import { LabeledEntity } from './Entity'
import { Metrics } from './Metrics'
import { TrainDialog, TrainScorerStep, TextVariation, TrainExtractorStep, TrainRound, ExtractorStepType } from './TrainDialog'
import { LogDialog, LogScorerStep, LogExtractorStep, LogRound } from './LogDialog'
import { ActionTypes } from './Action'
import { ExtractResponse } from './Extract'

export namespace MockData {

    export function makeEntityValues(): MemoryValue[] {
        return [{
            "userText": "userText",
            "displayText": "displayText",
            "builtinType": null,
            "resolution": {}
        }]
    }

    export function makeFilledEntity(entityId?: string): FilledEntity {
        return {
            entityId: entityId || ModelUtils.generateGUID(),
            values: makeEntityValues()
        }
    }

    export function makeScoreInput(entityIds?: string[]): ScoreInput {
        const fillledEntities = entityIds ?
            entityIds.map(eid => makeFilledEntity(eid)) : [makeFilledEntity()]
        return {
            filledEntities: fillledEntities,
            context: {},
            maskedActions: []
        }
    }

    export function makeTrainScorerStep(labelAction?: string, filledEntityIds?: string[]): TrainScorerStep {
        return {
            input: makeScoreInput(filledEntityIds),
            logicResult: undefined,
            scoredAction: undefined,
            labelAction: labelAction || ModelUtils.generateGUID()
        }
    }

    export function makeMetrics(): Metrics {
        return {
            wallTime: 10
        }
    }

    export function makeScoreBase(): ScoredBase {
        return {
            actionId: ModelUtils.generateGUID(),
            payload: "payload",
            isTerminal: true,
            actionType: ActionTypes.TEXT
        }
    }

    export function makeUnscoredAction(): UnscoredAction {
        return { ...makeScoreBase(), reason: "reason" }
    }

    export function makeUnscoredActions(): UnscoredAction[] {
        const numActions = randomInt(1, 2)
        return Array.from({ length: numActions }).map(() => makeUnscoredAction())
    }

    export function makeScoredAction(): ScoredAction {
        return { ...makeScoreBase(), score: 0.5 }
    }

    export function makeScoredActions(): ScoredAction[] {
        const numActions = randomInt(1, 2)
        return Array.from({ length: numActions }).map(() => makeScoredAction())
    }

    export function makeScoreResponse(): ScoreResponse {
        return {
            scoredActions: makeScoredActions(),
            unscoredActions: makeUnscoredActions(),
            metrics: makeMetrics()
        }
    }
    export function makeLogScorerStep(predictedAction?: string, filledEntityIds?: string[]): LogScorerStep {
        return {
            input: makeScoreInput(filledEntityIds),
            logicResult: undefined,
            predictedAction: predictedAction || ModelUtils.generateGUID(),
            predictionDetails: makeScoreResponse(),
            stepBeginDatetime: new Date().getTime().toString(),
            stepEndDatetime: (new Date().getTime() + 1000).toString(),
            metrics: makeMetrics()
        }
    }

    export function makeTrainScorerSteps(scorerSteps?: { [labelAction: string]: string[] | undefined }): TrainScorerStep[] {
        return scorerSteps
            ? Object.keys(scorerSteps).map(labelAction => makeTrainScorerStep(labelAction, scorerSteps[labelAction]))
            : []
    }

    export function makeLogScorerSteps(scorerSteps?: { [labelAction: string]: string[] | undefined }): LogScorerStep[] {
        return scorerSteps
            ? Object.keys(scorerSteps).map(labelAction => makeLogScorerStep(labelAction, scorerSteps[labelAction]))
            : []
    }

    export function makeLabelEntity(entityId?: string, entityValue?: string): LabeledEntity {
        return {
            "entityId": entityId || ModelUtils.generateGUID(),
            "startCharIndex": 0,
            "endCharIndex": 5,
            "entityText": entityValue || "hello",
            "resolution": {},
            "builtinType": ""
        }
    }

    export function makeLabelEntities(entities?: { [id: string]: string }): LabeledEntity[] {
        if (!entities) {
            return [makeLabelEntity()]
        }
        return Object.keys(entities).map(key =>
            makeLabelEntity(key, entities[key])
        )
    }

    export function makeTextVariation(entities?: { [id: string]: string }): TextVariation {
        return {
            text: entities ? Object.values(entities).join(" ") : "Hello World",
            labelEntities: makeLabelEntities(entities)
        }
    }

    export function makeTrainExtractorStep(textVariations?: { [id: string]: string }[]): TrainExtractorStep {
        return {
            textVariations: textVariations
                ? textVariations.map(entities => makeTextVariation(entities))
                : [makeTextVariation()],
            type: ExtractorStepType.USER_INPUT
        }
    }

    export function makeExtractResponse(): ExtractResponse {
        return {
            text: "user text",
            predictedEntities: [],
            metrics: makeMetrics(),
            packageId: ModelUtils.generateGUID(),
            definitions: { entities: [], actions: [], trainDialogs: [] }
        }
    }
    export function makeLogExtractorStep(): LogExtractorStep {
        return {
            ...makeExtractResponse(),
            stepBeginDatetime: new Date().getTime().toString(),
            stepEndDatetime: (new Date().getTime() + 1000).toString()
        }
    }

    export function makeTrainRound(roundData: RoundData): TrainRound {
        return {
            extractorStep: makeTrainExtractorStep(roundData.textVariations),
            scorerSteps: makeTrainScorerSteps(roundData.scorerSteps)
        }
    }

    export function makeLogRound(roundData: RoundData): LogRound {
        return {
            extractorStep: makeLogExtractorStep(),
            scorerSteps: makeLogScorerSteps(roundData.scorerSteps)
        }
    }

    export interface RoundData {
        textVariations?: { [id: string]: string }[],
        scorerSteps?: { [labelAction: string]: string[] | undefined }
    }

    export function makeLogDialog(rounds: RoundData[] = defaultRoundData, id?: string): LogDialog {
        return {
            rounds: rounds.map(round => makeLogRound(round)),
            createdDateTime: "",
            lastModifiedDateTime: "",
            logDialogId: id || ModelUtils.generateGUID(),
            initialFilledEntities: [],
            dialogBeginDatetime: new Date().getTime().toString(),
            dialogEndDatetime: (new Date().getTime() + 1000).toString(),
            metrics: "metrics",
            packageId: "packageId",
            targetTrainDialogIds: []
        }
    }

    export function makeTrainDialog(rounds: RoundData[] = defaultRoundData, id?: string): TrainDialog {
        return {
            rounds: rounds.map(round => makeTrainRound(round)),
            createdDateTime: "",
            lastModifiedDateTime: "",
            trainDialogId: id || ModelUtils.generateGUID(),
            version: 0,
            packageCreationId: 0,
            packageDeletionId: 0,
            initialFilledEntities: [],
            tags: [],
            description: "",
            sourceLogDialogId: ""
        }
    }

    // Return random number between min and max
    export function randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    const defaultRoundData = [
        {
            textVariations: [{
                "entity1_id": "entity1_value",
                "entity2_id": "entity2_value"
            }],
            // Round with one scorer step
            scorerSteps: {
                "action1": ["entity1_id", "entity2_id"]
            }
        },
        {
            textVariations: [{
                "entity3_id": "entity3_value"
            }],
            // Rounds without scorer step
            scorerSteps: undefined
        },
        {
            textVariations: [{
                "entity3_id": "entity3_value"
            }],
            // Round with multiple scorer steps
            scorerSteps: {
                "action2_id": ["entity1_id", "entity3_id"],
                "action1_id": ["entity1_id"]
            }
        },
        {
            textVariations: [{
                "entity1_id": "entity1_value"
            }],
            // End Round with multiple scorer steps
            scorerSteps: {
                "action4_id": ["entity1_id", "entity3_id"],
                "action1_id": ["entity1_id"]
            }
        }
    ]
}