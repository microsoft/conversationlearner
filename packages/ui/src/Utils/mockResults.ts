import * as OF from 'office-ui-fabric-react'
import { MockResultWithSource, MockResultsWithSource } from 'src/types'

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