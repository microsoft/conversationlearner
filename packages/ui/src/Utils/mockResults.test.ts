import * as CLM from '@conversationlearner/models'
import { MockResultSource } from '../types'
import * as MockResultUtil from './mockResults'

describe(`Mock Results Utilities`, () => {
    describe(`assignSourcesToMockResults`, () => {
        test(`Sources are assigned to every mock result in list`, () => {
            const testData: {
                mockResults1: CLM.CallbackResult[]
                mockResults2: CLM.CallbackResult[]
            } = {
                mockResults1: [
                    {
                        name: `mockResult1`,
                        entityValues: {},
                        returnValue: undefined,
                    },
                ],
                mockResults2: [
                    {
                        name: `mockResult2`,
                        entityValues: {},
                        returnValue: undefined,
                    },
                ]
            }

            const mockResultsWithSource = MockResultUtil.assignSourcesToMockResults(
                { mockResults: testData.mockResults1, source: MockResultSource.CODE },
                { mockResults: testData.mockResults2, source: MockResultSource.MODEL },
            )

            expect(mockResultsWithSource[0].source).toBe(MockResultSource.CODE)
            expect(mockResultsWithSource[1].source).toBe(MockResultSource.MODEL)
        })
    })

    describe(`convertCallbackResultToDropdownOption`, () => {
        test(`use name as key and text`, () => {
            const testData = {
                result: {
                    mockResult: {
                        name: `mockResult1`,
                        entityValues: {},
                        returnValue: undefined,
                    },
                    source: MockResultSource.CODE
                }
            }

            const dropdownOption = MockResultUtil.convertCallbackResultToDropdownOption(testData.result)

            expect(dropdownOption.key).toBe(testData.result.mockResult.name)
            expect(dropdownOption.text).toBe(testData.result.mockResult.name)
        })
    })

    describe(`areCallbackResultsEqual`, () => {
        describe(`different callbacks`, () => {
            test(`given different name should return false`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {},
                                returnValue: undefined,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult2`,
                                entityValues: {},
                                returnValue: undefined,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(false)
            })

            test(`given different return value should return false`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {},
                                returnValue: 1,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {},
                                returnValue: 2,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(false)
            })

            test(`given different return entities should return false`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: 1,
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: 1,
                                    b: 2,
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(false)
            })

            test(`given different return entity values should return false`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: 1,
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: 2,
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(false)
            })

            test(`given different return entity values should return false`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: 1,
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {
                                    a: [1],
                                },
                                returnValue: 1,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(false)
            })
        })

        describe(`equal callbacks`, () => {
            test(`even if source is different should return true`, () => {
                const testData = {
                    mockResultsWithSource1: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {},
                                returnValue: undefined,
                            },
                            source: MockResultSource.CODE,
                        }
                    ],
                    mockResultsWithSource2: [
                        {
                            mockResult: {
                                name: `mockResult1`,
                                entityValues: {},
                                returnValue: undefined,
                            },
                            source: MockResultSource.MODEL,
                        }
                    ]
                }

                const areEqual = MockResultUtil.areCallbackResultsEqual(testData.mockResultsWithSource1, testData.mockResultsWithSource2)

                expect(areEqual).toBe(true)
            })
        })
    })

    describe(`getMockResultErrors`, () => {
        test(`given callback with no errors should return empty errors list`, () => {
            const testData: {
                entities: CLM.EntityBase[],
                mockResult: CLM.CallbackResult
            } = {
                entities: [
                    createEntity('e1'),
                    createEntity('e2', true),
                ],
                mockResult: {
                    name: `mr1`,
                    entityValues: {
                        e1: 'v1',
                        e2: ['v1', 'v2'],
                    },
                    returnValue: 1,
                }
            }

            const errors = MockResultUtil.getMockResultErrors(testData.mockResult, testData.entities)

            expect(errors.length).toBe(0)
        })

        test(`given callback referencing entity that does not exist returns error`, () => {
            const testData: {
                entities: CLM.EntityBase[],
                mockResults: CLM.CallbackResult
            } = {
                entities: [
                    createEntity('e1'),
                    createEntity('e2'),
                ],
                mockResults: {
                    name: `mr1`,
                    entityValues: {
                        missingEntityKey: 'v1',
                    },
                    returnValue: undefined,
                }
            }

            const errors = MockResultUtil.getMockResultErrors(testData.mockResults, testData.entities)

            expect(errors.length).toBeGreaterThan(0)
        })

        test(`given callback referencing entity with single value assigned to multi value`, () => {
            const testData: {
                entities: CLM.EntityBase[],
                mockResults: CLM.CallbackResult
            } = {
                entities: [
                    createEntity('e1'),
                    createEntity('e2', true),
                ],
                mockResults: {
                    name: `mr1`,
                    entityValues: {
                        e1: 'v1',
                        e2: 'v2',
                    },
                    returnValue: undefined,
                }
            }

            const errors = MockResultUtil.getMockResultErrors(testData.mockResults, testData.entities)

            expect(errors.length).toBeGreaterThan(0)
        })

        test(`given callback referencing entity with multi value assigned to single value`, () => {
            const testData: {
                entities: CLM.EntityBase[],
                mockResults: CLM.CallbackResult
            } = {
                entities: [
                    createEntity('e1'),
                    createEntity('e2', true),
                ],
                mockResults: {
                    name: `mr1`,
                    entityValues: {
                        e1: ['v1', 'v2'],
                        e2: 'v2',
                    },
                    returnValue: undefined,
                }
            }

            const errors = MockResultUtil.getMockResultErrors(testData.mockResults, testData.entities)

            expect(errors.length).toBeGreaterThan(0)
        })
    })
})

function createEntity(
    entityName: string,
    isMultivalue: boolean = false,
): CLM.EntityBase {
    return {
        entityId: `${entityName}-id`,
        entityName,
        entityType: CLM.EntityType.LOCAL,
        resolverType: null,
        createdDateTime: new Date().toJSON(),
        version: null,
        packageCreationId: null,
        packageDeletionId: null,
        isMultivalue,
        isNegatible: false,
        isResolutionRequired: false,
        negativeId: null,
        positiveId: null,
        doNotMemorize: null,
    }
}