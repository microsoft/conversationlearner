import * as OF from 'office-ui-fabric-react'
import { MockResultWithSource, MockResultsWithSource } from 'src/types'

export const assignSourcesToMockResults = (...mockResultsWithSourceList: MockResultsWithSource[]): MockResultWithSource[] => {
    return mockResultsWithSourceList.reduce<MockResultWithSource[]>((mockResultWithSourceList, mockResultsWithSource) => {
        mockResultWithSourceList.push(...mockResultsWithSource.mockResults.map(mockResult => ({ mockResult, source: mockResultsWithSource.source })))
        return mockResultWithSourceList
    }, [])
}

export const convertCallbackResultToDropdownOption = (mockResultWithSource: MockResultWithSource): OF.IDropdownOption =>
    ({
        key: mockResultWithSource.mockResult.name,
        text: mockResultWithSource.mockResult.name,
        data: mockResultWithSource,
    })