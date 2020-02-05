import * as OF from 'office-ui-fabric-react'
import * as CLM from '@conversationlearner/models'
import { MockResultWithSource, MockResultsWithSource } from '../types'

export function assignSourcesToMockResults(...mockResultsWithSourceList: MockResultsWithSource[]): MockResultWithSource[] {
    return mockResultsWithSourceList.reduce<MockResultWithSource[]>((mockResultWithSourceList, mockResultsWithSource) => {
        mockResultWithSourceList.push(...mockResultsWithSource.mockResults.map(mockResult => ({ mockResult, source: mockResultsWithSource.source })))
        return mockResultWithSourceList
    }, [])
}

export function convertCallbackResultToDropdownOption(mockResultWithSource: MockResultWithSource): OF.IDropdownOption {
    return {
        key: mockResultWithSource.mockResult.name,
        text: mockResultWithSource.mockResult.name,
        data: mockResultWithSource,
    }
}

export function areCallbackResultsEqual(mockResultsA: MockResultWithSource[], mockResultsB: MockResultWithSource[]): boolean {
    if (mockResultsA.length !== mockResultsB.length) {
        return false
    }

    for (const mockResultFromB of mockResultsB) {
        const matchingMockResult = mockResultsA.find(m => m.mockResult.name === mockResultFromB.mockResult.name)
        // If result by name is not found
        if (!matchingMockResult) {
            return false
        }

        // If return value is changed
        if (mockResultFromB.mockResult.returnValue != matchingMockResult.mockResult.returnValue) {
            return false
        }

        // If entity values length are different
        const entityValueEntriesFromB = Object.entries(mockResultFromB.mockResult.entityValues)
        const entityValueEntriesFromMatching = Object.entries(matchingMockResult.mockResult.entityValues)
        if (entityValueEntriesFromB.length != entityValueEntriesFromMatching.length) {
            return false
        }

        for (const [entityNameB, entityValuesB] of entityValueEntriesFromB) {
            const matchingEntityValueEntry = entityValueEntriesFromMatching.find(([entityName]) => entityName === entityNameB)
            if (!matchingEntityValueEntry) {
                return false
            }

            const [, entityValuesA] = matchingEntityValueEntry
            // If different types (shouldn't be possible unless entity changes)
            if (Array.isArray(entityValuesA) !== Array.isArray(entityValuesB)) {
                return false
            }

            // If both single value
            if (!Array.isArray(entityValuesA) && !Array.isArray(entityValuesB)) {
                if (entityValuesA !== entityValuesB) {
                    return false
                }
            }

            if (Array.isArray(entityValuesA) && Array.isArray(entityValuesB)) {
                if (entityValuesA.length !== entityValuesB.length) {
                    return false
                }

                const areValuesEqual = entityValuesB.every((b, i) => b === entityValuesA[i])
                if (!areValuesEqual) {
                    return false
                }
            }
        }
    }

    return true
}

export function getMockResultErrors(mockResult: CLM.CallbackResult, entities: CLM.EntityBase[]): string[] {
    const errors: string[] = []

    for (const [entityKey, entityValues] of Object.entries(mockResult.entityValues)) {
        const entity = entities.find(e => e.entityId === entityKey || e.entityName === entityKey)
        if (entity === undefined) {
            errors.push(`Mock Result ${mockResult.name} referenced an entity that does not exist. Entity key: ${entityKey}`)
            continue
        }

        if (entityValues != null) {
            if (entity?.isMultivalue === true
                && Array.isArray(entityValues) === false) {
                errors.push(`Mock Result ${mockResult.name} referenced an entity ${entity.entityName} that is multi value but was assigned a single value. It should assign a list of values.`)
                continue
            } else if (entity?.isMultivalue !== true
                && Array.isArray(entityValues) === true) {
                errors.push(`Mock Result ${mockResult.name} referenced an entity ${entity.entityName} that is singe value but was assigned multiple values. It should assign a single value.`)
                continue
            }
        }
    }

    return errors
}