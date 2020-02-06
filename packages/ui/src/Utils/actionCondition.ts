/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import produce from 'immer'
import { PreBuilts } from '../types'

export interface IConditionalTag extends OF.ITag {
    condition: CLM.Condition | null
}

export const conditionDisplay: Record<CLM.ConditionType, string> = {
    [CLM.ConditionType.EQUAL]: '==',
    [CLM.ConditionType.NOT_EQUAL]: '!=',
    [CLM.ConditionType.GREATER_THAN]: '>',
    [CLM.ConditionType.GREATER_THAN_OR_EQUAL]: '>=',
    [CLM.ConditionType.LESS_THAN]: '<',
    [CLM.ConditionType.LESS_THAN_OR_EQUAL]: '<=',
}

export const getEnumConditionName = (entity: CLM.EntityBase, enumValue: CLM.EnumValue): string => {
    return `${entity.entityName} == ${enumValue.enumValue}`
}

export const getValueConditionName = (entity: CLM.EntityBase, condition: CLM.Condition): string => {
    return `${entity.entityName} ${conditionDisplay[condition.condition]} ${condition.value}`
}

export const convertConditionToConditionalTag = (condition: CLM.Condition, entities: CLM.EntityBase[]): IConditionalTag => {
    const entity = entities.find(e => e.entityId === condition.entityId)
    if (!entity) {
        throw new Error(`Condition refers to non-existent Entity ${condition.entityId}`)
    }

    let conditionalTag: IConditionalTag
    if (entity.entityType === CLM.EntityType.ENUM) {
        if (!entity.enumValues) {
            throw new Error(`Condition refers to Entity without Enums ${entity.entityName}`)
        }

        const enumValueId = condition.valueId
        if (!enumValueId) {
            throw new Error(`Condition refers to enum entity: ${entity.entityName}, but condition did not have enum value id.`)
        }
        const enumValue = entity.enumValues.find(e => e.enumValueId === enumValueId)
        if (!enumValue) {
            throw new Error(`Condition refers to non-existent EnumValue: ${enumValueId} on enum entity: ${entity.entityName}`)
        }

        const name = getEnumConditionName(entity, enumValue)
        conditionalTag = {
            key: enumValue.enumValueId!,
            name,
            condition,
        }
    }
    else {
        const name = getValueConditionName(entity, condition)
        const key = CLM.hashText(name)
        conditionalTag = {
            key,
            name,
            condition,
        }
    }

    return conditionalTag
}

export const isConditionEqual = (conditionA: CLM.Condition, conditionB: CLM.Condition): boolean => {
    return conditionA.entityId === conditionB.entityId
        && conditionA.condition === conditionB.condition
        && conditionA.valueId === conditionB.valueId
        && conditionA.value === conditionB.value
}

/**
 * Given memory value,
 * If entity is multivalue returns the number of labels/values
 * If entity has number resolution return number from label
 * Otherwise, return undefined to indicate number can't be parsed from memory
 */
export const findNumberFromMemory = (memory: CLM.Memory, isMultivalue: boolean): number | undefined => {
    if (isMultivalue) {
        return memory.entityValues.length
    }

    const valueString: string | undefined = (memory?.entityValues?.[0]?.resolution as any).value

    return valueString
        ? parseInt(valueString, 10)
        : undefined
}

export const isValueConditionTrue = (condition: CLM.Condition, numberValue: number): boolean => {
    let isTrue = false

    if (condition.value) {
        isTrue = (condition.condition === CLM.ConditionType.EQUAL && numberValue === condition.value)
            || (condition.condition === CLM.ConditionType.NOT_EQUAL && numberValue !== condition.value)
            || (condition.condition === CLM.ConditionType.GREATER_THAN && numberValue > condition.value)
            || (condition.condition === CLM.ConditionType.GREATER_THAN_OR_EQUAL && numberValue >= condition.value)
            || (condition.condition === CLM.ConditionType.LESS_THAN && numberValue < condition.value)
            || (condition.condition === CLM.ConditionType.LESS_THAN_OR_EQUAL && numberValue <= condition.value)
    }

    return isTrue
}

export const isEnumConditionTrue = (condition: CLM.Condition, memory: CLM.Memory): boolean => {
    const enumValueId = memory?.entityValues[0]?.enumValueId

    return condition.valueId !== undefined
        && condition.valueId === enumValueId
}

export const getUniqueConditions = (actions: CLM.ActionBase[]): CLM.Condition[] => {
    const allConditions = actions
        .map(a => [...a.requiredConditions, ...a.negativeConditions])
        .reduce((a, b) => [...a, ...b], [])

    return allConditions
        .reduce<CLM.Condition[]>((conditions, condition) => {
            const matchingCondition = conditions.find(c => isConditionEqual(c, condition))
            // If no identical condition was found, condition is unique, add it to list
            if (!matchingCondition) {
                conditions.push(condition)
            }

            return conditions
        }, [])
}

/**
 * Returns actions using the existing condition with modifications of existing condition replaced by new condition.
 * Could be split into a filter then map, but the work to find if action is using condition is close to work to replace.
 * 
 * @param actions List of actions
 * @param existingCondition Existing Condition
 * @param newCondition New Condition
 */
export const getUpdatedActionsUsingCondition = (actions: CLM.ActionBase[], existingCondition: CLM.Condition, newCondition: CLM.Condition): CLM.ActionBase[] => {
    return actions.reduce<CLM.ActionBase[]>((actionsUsingCondition, action) => {
        let isActionUsingCondition = false

        const actionWithConditionReplaced = produce(action, draftAction => {
            const requiredConditionIndex = draftAction.requiredConditions.findIndex(c => isConditionEqual(c, existingCondition))
            if (requiredConditionIndex >= 0) {
                draftAction.requiredConditions.splice(requiredConditionIndex, 1, newCondition)
                isActionUsingCondition = true
            }

            const negativeConditionIndex = draftAction.negativeConditions.findIndex(c => isConditionEqual(c, existingCondition))
            if (negativeConditionIndex >= 0) {
                draftAction.negativeConditions.splice(negativeConditionIndex, 1, newCondition)
                isActionUsingCondition = true
            }
        })

        if (isActionUsingCondition) {
            actionsUsingCondition.push(actionWithConditionReplaced)
        }

        return actionsUsingCondition
    }, [])
}

/**
 * Given entity return true if entity can be used in condition false otherwise
 */
export const isEntityAllowedInCondition = (entity: CLM.EntityBase): boolean => {
    if (entity.entityType === CLM.EntityType.ENUM) {
        return true
    }

    if (entity.entityType === CLM.EntityType.LUIS
        && entity.resolverType === PreBuilts.Number
        && entity.isResolutionRequired === true) {
        return true
    }

    if (entity.isMultivalue === true) {
        return true
    }

    return false
}