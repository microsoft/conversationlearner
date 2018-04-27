/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { ActionArgument, ActionTypes, ActionBase, ActionPayload, TextPayload, IActionArgument } from './Action'

const createEmptyAction = (): ActionBase => ({
  actionId: '',
  payload: '',
  isTerminal: false,
  requiredEntities: [],
  negativeEntities: [],
  suggestedEntity: '',
  version: 0,
  packageCreationId: 0,
  packageDeletionId: 0,
  actionType: ActionTypes.TEXT
})

const textPayloadWithNoEntities: TextPayload = {
  json: {
    kind: 'value',
    document: {
      kind: 'document',
      data: {},
      nodes: [
        {
          kind: 'block',
          type: 'line',
          isVoid: false,
          data: {},
          nodes: [
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: 'simple text payload',
                  marks: []
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

const textPayloadWithRequiredEntity: TextPayload = {
  json: {
    kind: 'value',
    document: {
      kind: 'document',
      data: {},
      nodes: [
        {
          kind: 'block',
          type: 'line',
          isVoid: false,
          data: {},
          nodes: [
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: 'The value of custom is: ',
                  marks: []
                }
              ]
            },
            {
              kind: 'inline',
              type: 'mention-inline-node',
              isVoid: false,
              data: {
                completed: true,
                option: {
                  id: '627a43be-4675-4b98-84a7-537262561be6',
                  name: 'custom'
                }
              },
              nodes: [
                {
                  kind: 'text',
                  leaves: [
                    {
                      kind: 'leaf',
                      text: '$custom',
                      marks: []
                    }
                  ]
                }
              ]
            },
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: '',
                  marks: []
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

const textPayloadWithRequiredEntityAndOptionalEntity: TextPayload = {
  json: {
    kind: 'value',
    document: {
      kind: 'document',
      data: {},
      nodes: [
        {
          kind: 'block',
          type: 'line',
          isVoid: false,
          data: {},
          nodes: [
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: 'Action with required ',
                  marks: []
                }
              ]
            },
            {
              kind: 'inline',
              type: 'mention-inline-node',
              isVoid: false,
              data: {
                completed: true,
                option: {
                  id: '627a43be-4675-4b98-84a7-537262561be6',
                  name: 'custom'
                }
              },
              nodes: [
                {
                  kind: 'text',
                  leaves: [
                    {
                      kind: 'leaf',
                      text: '$custom',
                      marks: []
                    }
                  ]
                }
              ]
            },
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: ' entity and ',
                  marks: []
                }
              ]
            },
            {
              kind: 'inline',
              type: 'optional-inline-node',
              isVoid: false,
              data: {},
              nodes: [
                {
                  kind: 'text',
                  leaves: [
                    {
                      kind: 'leaf',
                      text: '[ optional ',
                      marks: []
                    }
                  ]
                },
                {
                  kind: 'inline',
                  type: 'mention-inline-node',
                  isVoid: false,
                  data: {
                    completed: true,
                    option: {
                      id: '5745fcb3-93ef-405a-b587-8edfb9f0a6a4',
                      name: 'name'
                    }
                  },
                  nodes: [
                    {
                      kind: 'text',
                      leaves: [
                        {
                          kind: 'leaf',
                          text: '$name',
                          marks: []
                        }
                      ]
                    }
                  ]
                },
                {
                  kind: 'text',
                  leaves: [
                    {
                      kind: 'leaf',
                      text: ' entity]',
                      marks: []
                    }
                  ]
                }
              ]
            },
            {
              kind: 'text',
              leaves: [
                {
                  kind: 'leaf',
                  text: '',
                  marks: []
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
const textAction1: ActionBase = {
  ...createEmptyAction(),
  actionType: ActionTypes.TEXT,
  payload: JSON.stringify(textPayloadWithNoEntities)
}

const textAction2: ActionBase = {
  ...createEmptyAction(),
  actionType: ActionTypes.TEXT,
  payload: JSON.stringify(textPayloadWithRequiredEntity)
}

const expectedCardPayloadValue = 'customTemplateName'
const cardActionArguments: IActionArgument[] = [
  {
    parameter: 'p1',
    value: {
      json: {}
    }
  },
  {
    parameter: 'p2',
    value: {
      json: {}
    }
  }
]

const expectedCardActionArguments = cardActionArguments.map(aa => new ActionArgument(aa))
const cardAction: ActionBase = {
  ...createEmptyAction(),
  actionType: ActionTypes.CARD,
  payload: JSON.stringify({
    payload: expectedCardPayloadValue,
    arguments: cardActionArguments
  } as ActionPayload)
}

const expectedApiPayloadValue = 'myCallback'
const apiAction: ActionBase = {
  ...createEmptyAction(),
  actionType: ActionTypes.API_LOCAL,
  payload: JSON.stringify({
    payload: expectedApiPayloadValue,
    arguments: [
      {
        parameter: 'p1',
        value: {
          json: {}
        }
      },
      {
        parameter: 'p2',
        value: {
          json: {}
        }
      }
    ]
  } as ActionPayload)
}

describe('Action', () => {
  describe('GetPayload', () => {
    test('given text action should return the plain text string', () => {
      // Act
      const actualTextPayloadValue = ActionBase.GetPayload(textAction1, new Map<string, string>())

      // Assert
      expect(actualTextPayloadValue).toEqual('simple text payload')
    })

    test('given text action containing entity reference should return the plain text string with value replaced', () => {
      // Act
      const actualTextPayloadValue = ActionBase.GetPayload(
        textAction2,
        new Map<string, string>([['627a43be-4675-4b98-84a7-537262561be6', 'customValue']])
      )

      // Assert
      expect(actualTextPayloadValue).toEqual('The value of custom is: customValue')
    })

    test('given card action should return card template name', () => {
      // Act
      const actualCardPayloadValue = ActionBase.GetPayload(cardAction, new Map<string, string>())

      // Assert
      expect(actualCardPayloadValue).toEqual(expectedCardPayloadValue)
    })

    test('given api action should return callback name', () => {
      // Act
      const actualApiPayloadValue = ActionBase.GetPayload(apiAction, new Map<string, string>())

      // Assert
      expect(actualApiPayloadValue).toEqual(expectedApiPayloadValue)
    })
  })

  describe('GetActionArguments', () => {
    test('given text action should return empty array because text actions do not have arguments', () => {
      // Act
      const actionArguments = ActionBase.GetActionArguments(textAction1)

      // Assert
      expect(actionArguments).toEqual([])
    })

    test('given card action or api action should return arguments', () => {
      // Act
      const actionArguments = ActionBase.GetActionArguments(cardAction)

      // Assert
      expect(actionArguments).toEqual(expectedCardActionArguments)
    })
  })
})
