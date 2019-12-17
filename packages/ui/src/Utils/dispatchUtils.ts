import * as CLM from '@conversationlearner/models'
import { SourceAndModelPair } from "../types/models"
import * as uuid from 'uuid/v4'
import * as Util from './util'
import { DispatcherAlgorithmType } from '../components/modals/DispatcherCreator'

/**
 * Is currently the same implementation as third algorithm, but could be different
 * Test data should be different that the data it's testing and also consistent across algorithms
 */
const generateTestData = generateRandomMultiTransferDispatcherSource

/**
 * Generations new source based on child sources and given algorithm
 * @param sourceModelPairs Model Sources and Model Definitions Paired with each other.
 * @param algorithmType Type of generation Algorithm
 */
export function generateDispatcherSource(
    sourceModelPairs: SourceAndModelPair[],
    algorithmType: DispatcherAlgorithmType,
) {
    // TODO: Use declarative map [Type, Fn] instead of switch case
    switch (algorithmType) {
        case DispatcherAlgorithmType.DeterministicSingleTransfer:
            return generaterministicDispatcherSource(sourceModelPairs, 3)
        case DispatcherAlgorithmType.RandomSingleTransfer:
            return generateRandomTransitonDispatcherSource(sourceModelPairs, defaultGetPercentageOfRoundsToTransferAt)
        case DispatcherAlgorithmType.RandomMultiTransfer:
            return generateRandomMultiTransferDispatcherSource(sourceModelPairs, 20, 10)
        case DispatcherAlgorithmType.TestData:
            return generateTestData(sourceModelPairs, 20, 10)
        default:
            throw new Error(`Unhandled algorithm type ${algorithmType}`)
    }

    throw new Error(`Could not associate Dispatcher Algorithm Type with algorithm. You passed: ${algorithmType}`)
}

function defaultGetPercentageOfRoundsToTransferAt(numOfRounds: number): number {
    // If dialog is short attempt transfer at all pionts
    if (numOfRounds <= 3) {
        return numOfRounds
    }
    else if (numOfRounds <= 10) {
        return Math.round(numOfRounds * 0.4)
    }
    else if (numOfRounds <= 20) {
        return Math.round(numOfRounds * 0.2)
    }
    else {
        return Math.round(numOfRounds * 0.15)
    }
}

/**
 * Attempt to transition at first N number of rounds for each dialog in model, to a dialog in another model.
 * @param transitionAtFirstNRounds Limit on number of places to transfer between models. Defaults to 3
 */
function generaterministicDispatcherSource(
    sourceModelPairs: SourceAndModelPair[],
    transitionAtFirstNRounds: number,
): CLM.AppDefinition {
    generateDispatchActions(sourceModelPairs)
    const modelsTrainDialogs = associateModelDialogsWithDispatchActionsAndClean(sourceModelPairs)
    const trainDialogs = determisticSingleTransfer(modelsTrainDialogs, transitionAtFirstNRounds)
    return {
        trainDialogs,
        actions: sourceModelPairs.map(sm => sm.action),
        entities: [],
    }
}

/**
 * Attempt to transition at random N position in rounds for each dialog in model, to a dialog in another model.
 * @param getPercentageOfRoundsToTransferAt Limit on number of places to transfer between models. Defaults to 3
 */
function generateRandomTransitonDispatcherSource(
    sourceModelPairs: SourceAndModelPair[],
    // TODO: Should be percentage of dialog instead of fixed number?
    // 2 transition in 50 round dialog isn't good coverage
    // 2 transitions in 5 step dialog is better?
    getPercentageOfRoundsToTransferAt: (x: number) => number,
): CLM.AppDefinition {
    generateDispatchActions(sourceModelPairs)
    const modelsTrainDialogs = associateModelDialogsWithDispatchActionsAndClean(sourceModelPairs)
    const trainDialogs = randomSingleTransfer(modelsTrainDialogs, getPercentageOfRoundsToTransferAt)
    return {
        trainDialogs,
        actions: sourceModelPairs.map(sm => sm.action),
        entities: [],
    }
}

function generateRandomMultiTransferDispatcherSource(
    sourceModelPairs: SourceAndModelPair[],
    numberOfTransitionsPerDialog: number,
    numberOfDialogs: number,
): CLM.AppDefinition {
    generateDispatchActions(sourceModelPairs)
    const modelsTrainDialogs = associateModelDialogsWithDispatchActionsAndClean(sourceModelPairs)
    const trainDialogs = randomMultiTransfer(
        modelsTrainDialogs,
        numberOfTransitionsPerDialog,
        numberOfDialogs)

    return {
        trainDialogs,
        actions: sourceModelPairs.map(sm => sm.action),
        entities: [],
    }
}

/**
 * Generate 1 Dispatch Action per model and associate with source + model pair
 *
 * Store:
 * - modelId for dispatching
 * - modelName for display
 */
function generateDispatchActions(sourceModelPairs: SourceAndModelPair[]) {
    sourceModelPairs.forEach(smp => {
        // If object already has action associated, don't create new one
        if (smp.action) {
            return
        }

        const modelPayload: CLM.ModelPayload = {
            modelId: smp.model.appId,
            modelName: smp.model.appName
        }

        // TODO: Want strong typing, but this is source schema not ActionBase
        const dispatchAction = {
            actionId: uuid(),
            createdDateTime: new Date().toJSON(),
            actionType: CLM.ActionTypes.DISPATCH,
            payload: JSON.stringify(modelPayload),
            isTerminal: true,
            requiredEntitiesFromPayload: [],
            requiredEntities: [],
            negativeEntities: [],
            requiredConditions: [],
            negativeConditions: [],
            clientData: {
                actionHashes: [],
            }
        }

        smp.action = dispatchAction
    })
}

/**
 * For each dialog in model A set each rounds to use that models Dispatch Action
 * This means, when this input (extraction) is seen, dispatch to this model.
 *
 * Clear all entities, and ensure single scorer step
 */
function associateModelDialogsWithDispatchActionsAndClean(sourceModelPairs: SourceAndModelPair[]): CLM.TrainDialog[][] {
    return sourceModelPairs.map((sm, mIndex) => {
        if (!sm.action) {
            throw new Error(`(Source + Model) pair must have dispatch action assigned at this point`)
        }

        return sm.source.trainDialogs.map((t, tIndex) => {
            t.rounds.forEach(r => {
                // Clear label entities since this don't exist in this model
                r.extractorStep.textVariations.forEach(tv => {
                    tv.labelEntities = []
                })

                // Create clean scorer step with only labelAction id (no entities, masks, logicResult, etc)
                const scorerStep: CLM.TrainScorerStep = {
                    input: {
                        filledEntities: [],
                        context: {},
                        maskedActions: [],
                    },
                    labelAction: sm.action.actionId,
                    logicResult: undefined,
                    scoredAction: undefined,
                }

                r.scorerSteps = [
                    scorerStep
                ]
            })

            t.tags = [`model-${mIndex + 1}`, `dialog-${tIndex + 1}`]
            // t.description = `Model: ${sm.model.appName} - Dialog ${tIndex + 1}

            return t
        })
    })
}

const generateDispatchDialog = (rounds: CLM.TrainRound[]) => (
    {
        tags: [`generated`],
        description: "",
        trainDialogId: uuid(),
        rounds,

        // Ignored fields (Irrelevant for Dispatch function)
        clientData: {
            importHashes: []
        },
        initialFilledEntities: [],
        createdDateTime: new Date().toJSON(),
        lastModifiedDateTime: new Date().toJSON(),
    } as unknown as CLM.TrainDialog)

/**
 * Intermix rounds from different dialogs to implicitly demonstrate dispatching/context switching to other model
 *
 * Example
 * Dialogs:
 *  ModelA:
 *   [A,B,C]
 *  ModelB:
 *   [D,E,F]
 *  ModelC:
 *   [G,H,I]
 * ...
 *
 * Output:
 * [
 *  [A,D,E,F],
 *  [A,B,D,E,F],
 *  [A,B,C,D,E,F],
 *  [A,G,H,I],
 *  [A,B,G,H,I],
 *  [A,B,C,G,H,I],
 *  [D,A,B,C],
 *  [D,E,A,B,C],
 *  [D,E,F,A,B,C],
 *  [D,G,H,I],
 *  [D,E,G,H,I],
 *  [D,E,F,G,H,I],
 *  ...
 * ]
 *
 * Currently only tests single transition.
 * A to B or A to C
 * Could try re-entry patterns: A B A
 * Could try multi model switch: A B C
 */
function determisticSingleTransfer(
    modelsTrainDialogs: CLM.TrainDialog[][],
    transitionAtFirstNRounds: number
): CLM.TrainDialog[] {
    const allTrainDialogs = modelsTrainDialogs
        .reduce((a, b) => [...a, ...b])

    const dialogsWithoutModelTransition = Util.deepCopy(allTrainDialogs)
    const dialogTransitionGroups = generateDeterministicDialogTransitionGroups(modelsTrainDialogs, transitionAtFirstNRounds)
    const dialogsWithModelTransition = concatTransitionDialogsWithOtherDialogs(dialogTransitionGroups)
        .map(t => generateDispatchDialog(t.rounds))

    return [
        ...dialogsWithoutModelTransition,
        ...dialogsWithModelTransition
    ]
}

/**
 * Similar to deterministic transfer except try to transition and random N positions within dialog
 *
 * Array of rounds (with random transition points)
 *      1   2          3    4
 * [1,2,3,4,5,6,7,8,9,10,11,12,13,...]
 *  1   2         3            4
 * [1,2,3,4,5,6,7,8,9,10,11,12,13,...]
 */
function randomSingleTransfer(
    modelsTrainDialogs: CLM.TrainDialog[][],
    getPercentageOfRoundsToTransferAt: (x: number) => number,
): CLM.TrainDialog[] {
    const allTrainDialogs = modelsTrainDialogs.reduce((a, b) => [...a, ...b])
    const dialogsWithoutModelTransition = Util.deepCopy(allTrainDialogs)
    const dialogTransitionGroups = generateRandomDialogTransitionGroups(modelsTrainDialogs, getPercentageOfRoundsToTransferAt)
    const dialogsWithModelTransition = concatTransitionDialogsWithOtherDialogs(dialogTransitionGroups)
        .map(t => generateDispatchDialog(t.rounds))

    return [
        ...dialogsWithoutModelTransition,
        ...dialogsWithModelTransition
    ]
}

/**
 * Random Multi-Transfer Dialogs
 *
 * @param modelsTrainDialogs Dialogs per models
 * @param numberOfTransitionsPerDialog Number of Transitions per Dialog
 * @param numberOfDialogs Number of Dialogs
 */
function randomMultiTransfer(
    modelsTrainDialogs: CLM.TrainDialog[][],
    numberOfTransitionsPerDialog: number,
    numberOfDialogs: number,
): CLM.TrainDialog[] {
    const trainDialogs: CLM.TrainDialog[] = []
    // Server limitation of 100 rounds
    const maxRounds = 100
    // Could expose roundsPerDialog and calculate roundsPerTransition from the desired length but thought that was harder to imagine
    const numberOfRoundsPerTransition = Math.floor(maxRounds / numberOfTransitionsPerDialog)
    const numberOfRoundsPerDialog = maxRounds - numberOfRoundsPerTransition

    while (trainDialogs.length < numberOfDialogs) {
        let rounds: CLM.TrainRound[] = []
        let previousModelIndex: number = 0

        while (rounds.length < numberOfRoundsPerDialog) {
            // Pick new model to transition to, must not be same as previous
            let modelIndex: number
            do {
                modelIndex = Math.floor(Math.random() * modelsTrainDialogs.length)
            }
            while (modelIndex === previousModelIndex)

            // Get random dialog from model
            const dialogsInModel = modelsTrainDialogs[modelIndex]
            const dialogIndex = Math.floor(Math.random() * dialogsInModel.length)
            const dialog = dialogsInModel[dialogIndex]

            // Get random N consecutive rounds from dialog
            // Substract from N to ensure there is space for slice, otherwise use at least 1 round
            const maxIndex = Math.max(1, dialog.rounds.length - numberOfRoundsPerTransition)
            const startRoundIndex = Math.floor(Math.random() * maxIndex)
            let newRounds = dialog.rounds.slice(startRoundIndex, numberOfRoundsPerTransition)
            // TODO: Decide if there is better alternative. Dialog could not have as many rounds as requested but still be valid
            // Currently repeats chose rounds. Could choose other dialog but is very complicated
            while (newRounds.length < numberOfRoundsPerTransition) {
                newRounds.push(...newRounds)
            }
            newRounds = newRounds.slice(0, numberOfRoundsPerTransition)

            // Add new rounds to the total for dialog
            rounds.push(...newRounds)
            previousModelIndex = modelIndex
        }

        const trainDialog = generateDispatchDialog(rounds)
        trainDialogs.push(trainDialog)
        rounds = []
    }

    return trainDialogs
}

type DialogTransitionGroup = {
    trainDialogsToTransitionFrom: CLM.TrainDialog[]
    trainDialogsFromOtherModels: CLM.TrainDialog[]
}

/**
 * For each dialog to transition from, generate dialog for each of the other model dialogs with concatenation of rounds from A to B
 */
function concatTransitionDialogsWithOtherDialogs(dialogTransitionGroups: DialogTransitionGroup[]) {
    return dialogTransitionGroups
        .map(dialogTransitionGroup => {
            return dialogTransitionGroup.trainDialogsToTransitionFrom
                .map(t => {
                    return dialogTransitionGroup.trainDialogsFromOtherModels
                        .map(dialogFromOtherModel => {
                            const dialogCopy = Util.deepCopy(t)
                            dialogCopy.rounds = [
                                ...dialogCopy.rounds,
                                ...dialogFromOtherModel.rounds,
                            ]

                            return dialogCopy
                        })
                })
                .reduce((a, b) => [...a, ...b])
        })
        .reduce((a, b) => [...a, ...b])
}

function generateRandomDialogTransitionGroups(
    modelsTrainDialogs: CLM.TrainDialog[][],
    getPercentageOfRoundsToTransferAt: (x: number) => number,
) {
    return modelsTrainDialogs
        .map((modelDialogs, mIndex) => {
            /**
             * Original implementation attempted transitions within same model and preserved action
             * This could be good or introduce noise. Consider it as option
             */
            const trainDialogsFromOtherModels = modelsTrainDialogs
                .filter((_, k) => k !== mIndex)
                .reduce((a, b) => [...a, ...b])

            const trainDialogsToTransitionFrom = modelDialogs
                .map(t => {
                    const numRandomTransfersPoints = getPercentageOfRoundsToTransferAt(t.rounds.length)
                    const transitionRoundIncies = getUniqueRandomNumbers(numRandomTransfersPoints, t.rounds.length)

                    // For each transition point generate a new dialog with rounds up to that point
                    return transitionRoundIncies
                        .map(transitionRoundIndex => {
                            const dialogCopy = Util.deepCopy(t)
                            dialogCopy.rounds = dialogCopy.rounds.slice(0, transitionRoundIndex)
                            return dialogCopy
                        })
                })
                .reduce((a, b) => [...a, ...b])

            return {
                trainDialogsToTransitionFrom,
                trainDialogsFromOtherModels
            }
        })
}

function getUniqueRandomNumbers(length: number, max: number) {
    const numbers: number[] = []

    while (numbers.length < length) {
        const n = Math.ceil(Math.random() * max)
        if (!numbers.includes(n)) {
            numbers.push(n)
        }
    }

    return numbers
}

function generateDeterministicDialogTransitionGroups(
    modelsTrainDialogs: CLM.TrainDialog[][],
    transitionAtFirstNRounds: number
) {
    return modelsTrainDialogs
        .map((modelDialogs, mIndex) => {
            /**
             * Original implementation attempted transitions within same model and preserved action
             * This could be good or introduce noise. Consider it as option
             */
            const trainDialogsFromOtherModels = modelsTrainDialogs
                .filter((_, k) => k !== mIndex)
                .reduce((a, b) => [...a, ...b])

            const trainDialogsToTransitionFrom = modelDialogs
                .map(t => {
                    // TODO: Adapt to be able to transition at multiple points in dialog
                    // Beginning (First 4) and End (Last 4) ?
                    const possibleTransitionRounds = t.rounds.slice(0, transitionAtFirstNRounds)

                    // For each transition point generate a new dialog
                    return possibleTransitionRounds
                        .map((_, rIndex, rounds) => {
                            const dialogCopy = Util.deepCopy(t)
                            const roundsUpToTransitionPoint = rounds.slice(0, rIndex + 1)
                            dialogCopy.rounds = roundsUpToTransitionPoint
                            return dialogCopy
                        })
                })
                .reduce((a, b) => [...a, ...b])

            return {
                trainDialogsToTransitionFrom,
                trainDialogsFromOtherModels,
            }
        })
}
