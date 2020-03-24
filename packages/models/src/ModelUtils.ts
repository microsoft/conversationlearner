/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ExtractResponse } from './Extract'
import { Teach, TeachResponse } from './Teach'
import { TrainRound, TrainDialog, TrainScorerStep, TextVariation, CreateTeachParams, ExtractorStepType, TrainExtractorStep, OUT_OF_DOMAIN_INPUT } from './TrainDialog'
import { LogDialog, LogRound, LogScorerStep } from './LogDialog'
import { EntityBase, LabeledEntity, PredictedEntity } from './Entity'
import { ActionBase } from './Action'
import { MemoryValue } from './Memory'
import { FilledEntityMap, FilledEntity } from './FilledEntity'
import { AppDefinition } from './AppDefinition'

export class ModelUtils {
  public static generateGUID(): string {
    let d = new Date().getTime()
    let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      let r = ((d + Math.random() * 16) % 16) | 0
      d = Math.floor(d / 16)
      return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return guid
  }

  /** Remove n words from start of string */
  public static RemoveWords(text: string, numWords: number): string {
    if (text.length === 0 || numWords === 0) {
      return text
    }

    const firstSpace = text.indexOf(' ')
    const remaining = firstSpace > 0 ? text.slice(firstSpace + 1) : ''
    numWords--

    return this.RemoveWords(remaining, numWords)
  }

  //====================================================================
  // CONVERSION: LabeledEntity == PredictedEntity
  //====================================================================
  public static ToLabeledEntity(predictedEntity: PredictedEntity): LabeledEntity {
    const { score, ...labeledEntity } = predictedEntity
    return labeledEntity
  }

  public static ToLabeledEntities(predictedEntities: PredictedEntity[]): LabeledEntity[] {
    let labeledEntities: LabeledEntity[] = []
    for (let predictedEntity of predictedEntities) {
      let labelEntity = ModelUtils.ToLabeledEntity(predictedEntity)
      labeledEntities.push(labelEntity)
    }
    return labeledEntities
  }

  public static ToPredictedEntity(labeledEntity: LabeledEntity): PredictedEntity {
    return {
      ...labeledEntity,
      score: undefined
    }
  }

  public static ToPredictedEntities(labeledEntities: LabeledEntity[]): PredictedEntity[] {
    let predictedEntities: PredictedEntity[] = []
    for (let labeledEntity of labeledEntities) {
      let predictedEntity = ModelUtils.ToPredictedEntity(labeledEntity)
      predictedEntities.push(predictedEntity)
    }
    return predictedEntities
  }

  //====================================================================
  // CONVERSION: ExtractResponse == TextVariation
  //====================================================================
  public static ToTextVariation(extractResponse: ExtractResponse): TextVariation {
    let labeledEntities = this.ToLabeledEntities(extractResponse.predictedEntities)
    let textVariation = {
      text: extractResponse.text,
      labelEntities: labeledEntities
    }
    return textVariation
  }

  public static ToExtractResponse(textVariation: TextVariation): ExtractResponse {
    let predictedEntities = this.ToPredictedEntities(textVariation.labelEntities)
    let extractResponse: ExtractResponse = {
      definitions: {
        entities: [],
        actions: [],
        trainDialogs: []
      },
      packageId: '',
      metrics: {
        wallTime: 0
      },
      text: textVariation.text,
      predictedEntities: predictedEntities
    }
    return extractResponse
  }

  public static ToExtractResponses(textVariations: TextVariation[]): ExtractResponse[] {
    let extractResponses: ExtractResponse[] = []
    for (let textVariation of textVariations) {
      let predictedEntities = this.ToPredictedEntities(textVariation.labelEntities)
      let extractResponse: ExtractResponse = {
        definitions: {
          entities: [],
          actions: [],
          trainDialogs: []
        },
        packageId: '',
        metrics: {
          wallTime: 0
        },
        text: textVariation.text,
        predictedEntities: predictedEntities
      }
      extractResponses.push(extractResponse)
    }
    return extractResponses
  }

  public static ToTextVariations(extractResponses: ExtractResponse[]): TextVariation[] {
    let textVariations: TextVariation[] = []
    for (let extractResponse of extractResponses) {
      let labelEntities = this.ToLabeledEntities(extractResponse.predictedEntities)
      let textVariation: TextVariation = {
        text: extractResponse.text,
        labelEntities: labelEntities
      }
      textVariations.push(textVariation)
    }
    return textVariations
  }

  //====================================================================
  // CONVERSION: LogDialog == TrainDialog
  //====================================================================
  public static ToTrainDialog(
    logDialog: LogDialog,
    actions: ActionBase[] | null = null,
    entities: EntityBase[] | null = null
  ): TrainDialog {
    let trainRounds: TrainRound[] = []
    for (let logRound of logDialog.rounds) {
      let trainRound = ModelUtils.ToTrainRound(logRound)
      trainRounds.push(trainRound)
    }

    let appDefinition: AppDefinition | null = null
    if (entities !== null && actions !== null) {
      appDefinition = {
        entities,
        actions,
        trainDialogs: []
      }
    }

    // Update initialFilledEntity list to include those that were saved in onEndSession
    let initialFilledEntities: FilledEntity[] = []
    if (trainRounds.length !== 0 && trainRounds[0].scorerSteps.length !== 0) {

      // Get entities extracted on first input
      const firstEntityIds = trainRounds[0].extractorStep.textVariations[0]
        ? trainRounds[0].extractorStep.textVariations[0].labelEntities.map(le => le.entityId)
        : []

      // Intial entities are ones on first round that weren't extracted on the first utterance 
      initialFilledEntities = trainRounds[0].scorerSteps[0].input.filledEntities
        .filter(fe => !firstEntityIds.includes(fe.entityId!))
    }

    return {
      createdDateTime: logDialog.createdDateTime,
      lastModifiedDateTime: logDialog.lastModifiedDateTime,
      packageCreationId: 0,
      packageDeletionId: 0,
      trainDialogId: '',
      sourceLogDialogId: logDialog.logDialogId,
      version: 0,
      rounds: trainRounds,
      definitions: appDefinition,
      initialFilledEntities: initialFilledEntities,
      tags: [],
      description: ''
    }
  }

  //====================================================================
  // CONVERSION: LogRound == TrainRound
  //====================================================================
  public static ToTrainRound(logRound: LogRound): TrainRound {
    return {
      extractorStep: {
        textVariations: [
          {
            labelEntities: ModelUtils.ToLabeledEntities(logRound.extractorStep.predictedEntities),
            text: logRound.extractorStep.text
          }
        ],
        type: ExtractorStepType.USER_INPUT
      },
      scorerSteps: logRound.scorerSteps.map<TrainScorerStep>(logScorerStep => ({
        input: logScorerStep.input,
        labelAction: logScorerStep.predictedAction,
        logicResult: logScorerStep.logicResult,
        scoredAction: undefined,
        uiScoreResponse: logScorerStep.predictionDetails
      }))
    }
  }

  //====================================================================
  // CONVERSION: LogScorerStep == TrainScorerStep
  //====================================================================
  public static ToTrainScorerStep(logScorerStep: LogScorerStep): TrainScorerStep {
    return {
      input: logScorerStep.input,
      labelAction: logScorerStep.predictedAction,
      logicResult: logScorerStep.logicResult,
      scoredAction: undefined
    }
  }

  //====================================================================
  // CONVERSION: TrainDialog == CreateTeachParams
  //====================================================================
  public static ToCreateTeachParams(trainDialog: TrainDialog): CreateTeachParams {
    let createTeachParams: CreateTeachParams = {
      contextDialog: trainDialog.rounds,
      sourceLogDialogId: trainDialog.sourceLogDialogId,
      initialFilledEntities: trainDialog.initialFilledEntities
    }

    // TODO: Change to non destructive operation
    // Strip out "entityType" (*sigh*)
    for (let round of createTeachParams.contextDialog) {
      for (let textVariation of round.extractorStep.textVariations) {
        for (let labeledEntity of textVariation.labelEntities) {
          delete (labeledEntity as any).entityType
        }
      }
    }
    return createTeachParams
  }

  //====================================================================
  // CONVERSION: TeachResponse == Teach
  //====================================================================
  public static ToTeach(teachResponse: TeachResponse): Teach {
    return {
      teachId: teachResponse.teachId,
      trainDialogId: teachResponse.trainDialogId,
      createdDatetime: undefined,
      lastQueryDatetime: undefined,
      packageId: undefined
    }
  }

  //====================================================================
  // Misc utils shared between SDK and UI
  //====================================================================
  public static areEqualTextVariations(tv1: TextVariation, tv2: TextVariation) {
    if (tv1.text !== tv2.text) {
      return false
    }
    if (tv1.labelEntities.length !== tv2.labelEntities.length) {
      return false
    }
    for (const le1 of tv1.labelEntities) {
      const le2 = tv2.labelEntities.find(
        le => le.entityId === le1.entityId && le.entityText === le1.entityText && le.startCharIndex === le1.startCharIndex
      )
      if (!le2) {
        return false
      }
    }
    return true
  }

  public static areEqualMemoryValues(mvs1: MemoryValue[], mvs2: MemoryValue[]) {
    if (mvs1.length !== mvs2.length) {
      return false
    }
    for (let mv1 of mvs1) {
      const match = mvs2.find(mv2 => {
        if (mv1.userText !== mv2.userText) {
          return false
        }
        if (mv1.displayText !== mv2.displayText) {
          return false
        }
        if (mv1.builtinType !== mv2.builtinType) {
          return false
        }
        if (JSON.stringify(mv1.resolution) !== JSON.stringify(mv2.resolution)) {
          return false
        }
        return true
      })
      if (!match) {
        return false
      }
    }
    return true
  }

  public static changedFilledEntities(originalEntityMap: FilledEntityMap, newEntityMap: FilledEntityMap): FilledEntity[] {
    let changedFilledEntities: FilledEntity[] = []

    // Capture emptied entities
    for (let entityName in originalEntityMap.map) {
      if (!newEntityMap.map[entityName]) {
        const filledEntity = {
          entityId: originalEntityMap.map[entityName].entityId,
          values: []
        }
        changedFilledEntities.push(filledEntity)
      }
    }

    for (let entityName in newEntityMap.map) {
      // Capture new entities
      if (!originalEntityMap.map[entityName]) {
        changedFilledEntities.push(newEntityMap.map[entityName])
      }
      // Capture changed entities
      else if (!ModelUtils.areEqualMemoryValues(newEntityMap.map[entityName].values, originalEntityMap.map[entityName].values)) {
        changedFilledEntities.push(newEntityMap.map[entityName])
      }
    }

    return changedFilledEntities
  }

  public static userText(extractorStep: TrainExtractorStep, excludedEntities: string[] = [], useMarkdown: boolean = false) {
    if (extractorStep.type === ExtractorStepType.OUT_OF_DOMAIN) {
      return OUT_OF_DOMAIN_INPUT
    }
    if (useMarkdown) {
      return ModelUtils.textVariationToMarkdown(extractorStep.textVariations[0], excludedEntities)
    }
    return extractorStep.textVariations[0].text
  }

  public static textVariationToMarkdown(textVariation: TextVariation, excludeEntities: string[]) {
    if (textVariation.labelEntities.length === 0) {
      return textVariation.text
    }

    // Remove resolvers that aren't labelled
    let labelEntities = textVariation.labelEntities.filter(le => !excludeEntities.includes(le.entityId))

    // Remove duplicate labels
    labelEntities = labelEntities.filter((le, i) => labelEntities.findIndex(fi => fi.startCharIndex === le.startCharIndex) === i)

    // Remove overlapping labels (can happen if have CUSTOM and Pre-Trained)
    labelEntities = labelEntities.filter(le => labelEntities.findIndex(fe => fe.entityId !== le.entityId &&
      (le.startCharIndex >= fe.startCharIndex && le.endCharIndex <= fe.endCharIndex)) === -1)

    if (labelEntities.length === 0) {
      return textVariation.text
    }

    labelEntities = labelEntities.sort(
      (a, b) => (a.startCharIndex > b.startCharIndex ? 1 : a.startCharIndex < b.startCharIndex ? -1 : 0)
    )

    let text = textVariation.text.substring(0, labelEntities[0].startCharIndex)
    for (let index in labelEntities) {
      let curEntity = labelEntities[index]
      text = `${text}**_${textVariation.text.substring(curEntity.startCharIndex, curEntity.endCharIndex + 1)}_**`
      let nextEntity = labelEntities[Number(index) + 1]
      if (nextEntity) {
        text = `${text}${textVariation.text.substring(curEntity.endCharIndex + 1, nextEntity.startCharIndex)}`
      } else {
        text = `${text}${textVariation.text.substring(curEntity.endCharIndex + 1, textVariation.text.length)}`
      }
    }
    return text
  }

  public static PrebuiltDisplayText(builtinType: string, resolution: any, entityText: string): string {
    if (!builtinType || !resolution) {
      return entityText
    }

    if (['builtin.geography', 'builtin.encyclopedia'].some(prefix => builtinType.startsWith(prefix))) {
      return entityText
    }

    switch (builtinType) {
      case 'builtin.datetimeV2.date':
        let date = resolution.values[0].value
        if (resolution.values[1]) {
          date += ` or ${resolution.values[1].value}`
        }
        return date
      case 'builtin.datetimeV2.time':
        let time = resolution.values[0].value
        if (resolution.values[1]) {
          time += ` or ${resolution.values[1].value}`
        }
        return time
      case 'builtin.datetimeV2.daterange':
        return `${resolution.values[0].start} to ${resolution.values[0].end}`
      case 'builtin.datetimeV2.timerange':
        return `${resolution.values[0].start} to ${resolution.values[0].end}`
      case 'builtin.datetimeV2.datetimerange':
        return `${resolution.values[0].start} to ${resolution.values[0].end}`
      case 'builtin.datetimeV2.duration':
        return `${resolution.values[0].value} seconds`
      case 'builtin.datetimeV2.set':
        return `${resolution.values[0].value}`
      case 'builtin.number':
        return resolution.value
      case 'builtin.ordinal':
        return resolution.value
      case 'builtin.temperature':
        return resolution.value
      case 'builtin.dimension':
        return resolution.value
      case 'builtin.money':
        return resolution.value
      case 'builtin.age':
        return resolution.value
      case 'builtin.percentage':
        return resolution.value
      default:
        return entityText
    }
  }
}
