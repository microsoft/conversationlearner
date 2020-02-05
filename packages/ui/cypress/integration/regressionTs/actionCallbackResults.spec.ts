import * as util from '../../support/utilities'
import constants from '../../support/constants'
import s from '../../support/selectors'

describe('Action Callback Results', () => {
    const testData = {
        modelName: 'CallbackResults',
        modelFile: 'actionMockResults.cl',
        mockResultName: 'Mock Result from Text',
        callback: {
            name: 'Callback Results All Types',
            mockResults: {
                none: 'None',
                setAllEntities: 'Set All Entities - Code',
                entityErrors: 'Entity Errors - Code',
                partiallyCorrect: 'Partially Correct - Code',
                clearAllEntities: 'Clear All Entities - Code',
                resultToDelete: 'Result to Delete',
            },
        },
        dialogInputs: {
            noCallbackResult: 'No Result Chosen',
        },
        entityNames: [
            'myNumber',
            'myNumbers',
            'myString',
            'myStrings',
            'myBoolean',
            'myBooleans',
            'myObject',
            'myObjects',
        ],
        customCallbackName: 'Custom Callback Name from Test',
    }

    before(() => {
        cy.visit(`/`)
        util.importModel(testData.modelName, testData.modelFile)
        // Wait for training status to change. Sometimes training is fast and we can't rely on catching the transition to running status. Assume it happens and only ensure it's settled at completed.
        cy.wait(3000)
        cy.get(s.trainingStatus.completed, { timeout: constants.training.timeout })
        // Train
    })

    describe('Action Details List', () => {
        before(() => {
            cy.get(s.model.buttonNavActions)
                .click()
        })

        it(`should show an error on action which has errors in mock results`, () => {
            cy.get(s.actions.callbackName)
                .parents(s.actions.cells.response)
                .find(s.actions.iconError)
        })
    })

    describe('Action Modal', () => {
        before(() => {
            cy.get(s.model.buttonNavActions)
                .click()

            cy.get(s.actions.callbackName)
                .contains(testData.callback.name)
                .click()
        })

        it('should show results defined in Code', () => {
            cy.get(s.action.mockResult.codeRow)
                .should('have.length', 4)
        })

        it('should show results defined in Model', () => {
            cy.get(s.action.mockResult.modelRow)
                .should('have.length', 3)
        })

        it(`should open callback result modal when clicking on view button`, () => {
            cy.get(s.action.mockResult.row)
                .first()
                .find(s.action.mockResult.buttons.view)
                .click()

            cy.get(s.callbackResultModal.title)

            cy.get(s.callbackResultModal.buttons.cancel)
                .click()
        })

        it(`should show disabled deletion of results from code`, () => {
            cy.get(s.action.mockResult.codeRow)
                .find(s.action.mockResult.buttons.delete)
                .should('have.attr', 'disabled')
        })

        it(`should allow deletion of result from model`, () => {
            // TODO: Should find by text value instead of index. contains() doesn't work
            cy.get(s.action.mockResult.modelRow)
                .eq(2)
                .find(s.action.mockResult.buttons.delete)
                .should('not.have.attr', 'disabled')

            cy.get(s.action.mockResult.modelRow)
                .eq(2)
                .find(s.action.mockResult.buttons.delete)
                .click()

            cy.get(s.action.mockResult.modelRow)
                .eq(2)
                .should('not.exist')
        })

        it('should show help panel when header is clicked', () => {
            cy.get(s.action.helpIconCallbackResult)
                .click()
                .wait(500)

            cy.get(s.helpPanel.buttonClose)
                .click()
        })

        it(`should show errors on lists of code mock results`, () => {
            cy.get(s.action.mockResult.codeRow)
                .eq(1)
                .within(() => {
                    cy.get('[data-automation-id="error-message"]')
                    cy.get(s.action.mockResult.iconError)
                })
        })

        it(`should show errors on lists of model mock results`, () => {
            cy.get(s.action.mockResult.modelRow)
                .eq(1)
                .within(() => {
                    cy.get('[data-automation-id="error-message"]')
                    cy.get(s.action.mockResult.iconError)
                })
        })
    })

    describe(`Callback Result Modal`, () => {
        before(() => {
            cy.reload()
            cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                .should('not.exist')

            cy.get(s.model.buttonNavActions)
                .click()

            cy.get(s.actions.callbackName)
                .contains(testData.callback.name)
                .click()
        })

        describe(`Creation`, () => {
            it(`should open creation modal then clicking new mock result button`, () => {
                cy.get(s.action.mockResult.buttons.add)
                    .click()

                cy.get(s.callbackResultModal.title)
                    .contains('Create')
            })

            it(`should allow editing the name`, () => {
                cy.get(s.callbackResultModal.inputs.name)
                    .type(`New Result from Test`)
            })

            it(`should allow adding and removing entities within model`, () => {
                const entityName = 'myNumber'
                util.selectDropDownOption(s.callbackResultModal.dropdownEntity, entityName)
                cy.get(s.callbackResultModal.buttons.addEntity)
                    .click()

                getRemoveEntityValueButton(entityName, 0)
                    .click()

                util.selectDropDownOption(s.callbackResultModal.dropdownEntity, entityName)
                cy.get(s.callbackResultModal.buttons.addEntity)
                    .click()

                getEntityValue(entityName, 0)
                    .type('1')
            })

            it(`should allow adding and removing values to multi value entities`, () => {
                const entityName = 'myNumbers'
                util.selectDropDownOption(s.callbackResultModal.dropdownEntity, entityName)
                cy.get(s.callbackResultModal.buttons.addEntity)
                    .click()

                getEntityValue(entityName, 0)
                    .type('3')

                getAddValue(entityName)
                    .click()

                getEntityValue(entityName, 1)
                    .type('4')

                getAddValue(entityName)
                    .click()

                getEntityValue(entityName, 2)
                    .type('5')

                getRemoveEntityValueButton(entityName, 2)
                    .click()
            })

            it(`given the last value is removed, it will remove the entity`, () => {
                const entityName = 'myStrings'
                util.selectDropDownOption(s.callbackResultModal.dropdownEntity, entityName)
                cy.get(s.callbackResultModal.buttons.addEntity)
                    .click()

                getEntityValue(entityName, 0)
                    .type('my string value')

                getRemoveEntityValueButton(entityName, 0)
                    .click()

                cy.get(s.callbackResultModal.entityName)
                    .contains(entityName)
                    .should('not.exist')
            })

            it(`should disable the add button if there are no more entities available`, () => {
                cy.get(s.callbackResultModal.buttons.addEntity)
                    .should($button => {
                        expect($button).not.to.have.attr('disabled')
                    })
                    .click()
                    .click()
                    .click()
                    .click()
                    .click()
                    .click()
                    .should('have.attr', 'disabled')
            })

            it(`should allow editing the return value`, () => {
                cy.get(s.callbackResultModal.inputs.returnValue)
                    .type('Return Value from Text')
            })

            it(`should show the newly created mock result in the list of other mock results`, () => {
                cy.get(s.callbackResultModal.buttons.submit)
                    .click()

                cy.get(s.callbackResultModal.title)
                    .should('not.exist')

                cy.get(s.action.mockResult.modelRow)
                    .should('have.length', 4)
            })

            after(() => {
                cy.get(s.action.buttonCreate)
                    .click()

                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')
            })
        })

        describe(`Editing`, () => {
            before(() => {
                cy.reload()
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                cy.get(s.model.buttonNavActions)
                    .click()

                cy.get(s.actions.callbackName)
                    .contains(testData.callback.name)
                    .click()
            })

            it(`should discard edits to mock result if cancelled`, () => {
                // TODO: Get by text instead of index, so it's not order dependent
                cy.get(s.action.mockResult.modelRow)
                    .eq(0)
                    .find(s.action.mockResult.buttons.view)
                    .click()

                // Make Edits
                const entityName = 'myNumber'
                getEntityValue(entityName, 0)
                    .type('99')

                // Cancel
                cy.get(s.callbackResultModal.buttons.cancel)
                    .click()

                // Open
                cy.get(s.action.mockResult.modelRow)
                    .eq(0)
                    .find(s.action.mockResult.buttons.view)
                    .click()

                // Verify original value
                getEntityValue(entityName, 0)
                    .should('have.value', '3')

                // Cancel
                cy.get(s.callbackResultModal.buttons.cancel)
                    .click()
            })

            it(`edits to mock results should persist`, () => {
                // open
                cy.get(s.action.mockResult.modelRow)
                    .eq(2)
                    .find(s.action.mockResult.buttons.view)
                    .click()

                // edit
                cy.get(s.callbackResultModal.inputs.returnValue)
                    .type('99')

                // save
                cy.get(s.callbackResultModal.buttons.submit)
                    .click()

                cy.get(s.action.buttonCreate)
                    .click()

                cy.wait(1000)
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                // refresh
                cy.reload()
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                // open same action
                cy.get(s.actions.callbackName)
                    .contains(testData.callback.name)
                    .click()

                // open mock results
                cy.get(s.action.mockResult.modelRow)
                    .eq(2)
                    .find(s.action.mockResult.buttons.view)
                    .click()

                // verify same data
                cy.get(s.callbackResultModal.inputs.returnValue)
                    .should('have.value', '299')
            })
        })

        describe(`Errors`, () => {
            before(() => {
                cy.reload()
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                cy.get(s.model.buttonNavActions)
                    .click()

                cy.get(s.actions.callbackName)
                    .contains(testData.callback.name)
                    .click()
            })

            describe(`Code Mock Results`, () => {
                before(() => {
                    cy.get(s.action.mockResult.codeRow)
                        .eq(1)
                        .find(s.action.mockResult.buttons.view)
                        .click()
                })

                it(`should show errors about missing entity`, () => {
                    // Verify shows missing entity and error
                    cy.get(s.callbackResultModal.entityName)
                        .contains('missingEntity')

                    cy.get(s.callbackResultModal.entityNameError)

                    cy.get(s.callbackResultModal.entityValueError)
                        .should('have.length', 2)
                })

                it(`should still show values gracefully, but show errors for incorrect types (single to multi) assigned to entity`, () => {
                    getEntityValue('myNumbers', 0)
                        .should('have.value', '1')
                })

                it(`should still show values gracefully, but show errors for incorrect types (multi to single) assigned to entity`, () => {
                    getEntityValue('myString', 0)
                        .should('have.value', `"string1"`)
                    getEntityValue('myString', 1)
                        .should('have.value', `"string2"`)
                    getEntityValue('myString', 2)
                        .should('have.value', `"string3"`)
                })

                after(() => {
                    cy.get(s.callbackResultModal.buttons.cancel)
                })
            })

            describe(`Mock Mock Results`, () => {
                before(() => {
                    cy.get(s.action.mockResult.modelRow)
                        .eq(1)
                        .find(s.action.mockResult.buttons.view)
                        .click()
                })

                it(`should show errors about missing entity`, () => {
                    // Verify shows missing entity and error
                    cy.get(s.callbackResultModal.entityName)
                        .contains('invalid-entity')

                    cy.get(s.callbackResultModal.entityNameError)

                    cy.get(s.callbackResultModal.entityValueError)
                        .should('have.length', 2)
                })

                it(`should still show values gracefully, but show errors for incorrect types (single to multi) assigned to entity`, () => {
                    getEntityValue('myBooleans', 0)
                        .should('have.value', 'false')
                })

                it(`should still show values gracefully, but show errors for incorrect types (multi to single) assigned to entity`, () => {
                    getEntityValue('myNumber', 0)
                        .should('have.value', `4`)
                    getEntityValue('myNumber', 1)
                        .should('have.value', `5`)
                })

                after(() => {
                    cy.get(s.callbackResultModal.buttons.cancel)
                })
            })
        })

        describe(`Viewing Result as Code`, () => {
            before(() => {
                cy.reload()
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                cy.get(s.model.buttonNavActions)
                    .click()

                cy.get(s.actions.callbackName)
                    .contains(testData.callback.name)
                    .click()
            })

            describe(`Defined in Code`, () => {
                before(() => {
                    // TODO: Get by text?
                    // cy.get(s.action.mockResult.codeRow).contains(testData.callback.mockResults.entityErrors)
                    cy.get(s.action.mockResult.row)
                        .eq(1)
                        .find(s.action.mockResult.buttons.view)
                        .click()

                    cy.get(s.callbackResultModal.toggleView)
                        .click()
                })

                it(`should show exactly as defined even if it contains errors`, () => {
                    cy.get(s.callbackResultModal.code)
                        .contains(`{
  "name": "Entity Errors - Code",
  "entityValues": {
    "missingEntity": 3,
    "myNumbers": 1,
    "myString": [
      "string1",
      "string2",
      "string3"
    ]
  },
  "returnValue": 3
}`)
                })

                after(() => {
                    cy.get(s.callbackResultModal.buttons.cancel)
                        .click()
                })
            })

            describe(`Defined in Model`, () => {
                before(() => {
                    cy.get(s.action.mockResult.row)
                        .eq(4)
                        .find(s.action.mockResult.buttons.view)
                        .click()

                    cy.get(s.callbackResultModal.toggleView)
                        .click()
                })

                // TODO: Why does it not match?
                // Alternative is to get text and JSON.parse() then inspect it
                it.skip(`should match expected code definition`, () => {
                    // `should show name as is`
                    // `should show entities that exist on the model`
                    // `should show entities that are marked clear, or have no values as cleared`
                    // `should only show the non empty values for the entity`
                    // `should omit the return value is the return value is empty`
                    cy.get(s.callbackResultModal.code)
                        .contains(`{
  "name": "Set All Entities (Partial) - Model",
  "entityValues": {
    "myBoolean": "true",
    "myBooleans": [
      "false",
      "true"
    ],
    "myNumber": "399",
    "myNumbers": [
      "4",
      "5"
    ],
    "myString": "my string value",
    "myStrings": null,
    "myObject": null,
    "myObjects": [
      "{ \"id\": 1, \"title\": \"hello\" }"
    ]
  }
}`)
                })
            })
        })
    })

    describe(`Editing`, () => {
        before(() => {
            cy.reload()
            cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                .should('not.exist')
            cy.get(s.model.buttonNavActions)
                .click()

            cy.get(s.actions.buttonNewAction)
                .click()
        })

        it(`should allow creating mock result even if no Callback name is selected`, () => {
            util.selectDropDownOption(s.action.dropDownType, 'API')
            util.selectDropDownOption(s.action.dropDownApiCallback, constants.strings.customCallbackName)
            cy.get(s.action.inputCustomCallbackName)
                .type(testData.customCallbackName)

            cy.get(s.action.mockResult.buttons.add)
                .click()

            cy.get(s.callbackResultModal.inputs.name)
                .type(testData.mockResultName)

            cy.get(s.callbackResultModal.inputs.returnValue)
                .type(`Return Value From Text`)

            cy.get(s.callbackResultModal.buttons.submit)
                .click()

            cy.get(s.action.buttonCreate)
                .click()

            cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                .should('not.exist')

            cy.get(s.actions.callbackName)
                .contains(testData.customCallbackName)
        })
    })

    describe('Teaching', () => {
        describe('Action Scorer', () => {
            before(() => {
                cy.reload()
                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')
                cy.get(s.model.buttonNavTrainDialogs)
                    .click()

                cy.get(s.trainDialogs.buttonNew)
                    .click()
            })

            it('select action WITH callback WITHOUT selecting Callback Result should invoke callback', () => {
                util.inputText(testData.dialogInputs.noCallbackResult)
                util.clickScoreActionButton()
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                // Verify each entity is set in memory
                // TODO: Should also verify values, but they're random, existence is good enough
                cy.get(s.trainDialog.memory.entityName)
                    .should($entitiesNames => {
                        const entityNames = $entitiesNames.map((i, el) => Cypress.$(el).text()).get()
                        expect(entityNames.sort()).to.deep.eq([...testData.entityNames].sort())
                    })
            })

            it('select action WITH callback AND Callback Result selected should simulate result', () => {
                util.inputText(`Chose 'Set Values' Result`)
                util.clickScoreActionButton()

                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.setAllEntities)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')

                // TODO: Verify Array type if overwritten
                // TODO: Should also verify values, but their random, existence is good enough
                cy.get(s.trainDialog.memory.entityName)
                    .should($entitiesNames => {
                        const entityNames = $entitiesNames.map((i, el) => Cypress.$(el).text()).get()
                        expect(entityNames.sort()).to.deep.eq([...testData.entityNames].sort())
                    })
            })

            it('select action with Callback Results selected which REMOVES entities should effect memory', () => {
                util.inputText(`Chose 'Clear Values' Results`)
                util.clickScoreActionButton()
                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearAllEntities)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                // Have to enter another round to verify clearing effects
                util.inputText('Verify Memory Empty')
                util.clickScoreActionButton()
                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearAllEntities)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                // No entities in memory, since all are cleared from above
                cy.get(s.trainDialog.memory.entityName)
                    .should('not.exist')
            })

            it(`given action with no callback assigned it should, default the dropdown to one of the mock results`, () => {
                util.inputText(`Select action with no callback assigned`)
                util.clickScoreActionButton()

                // Dropdown defaults to Mock Result instead of None
                cy.get(s.trainDialog.actionScorer.callbackName)
                    .contains(testData.customCallbackName)
                    .parents(s.trainDialog.actionScorer.rowField)
                    .within(() => {
                        cy.get(s.trainDialog.actionScorer.callbackResultSelectorDropdown)
                            .contains(testData.mockResultName)
                    })
            })

            it(`given action with no callback assigned it should, execute the mock result as other callback results`, () => {
                // Note: even though mock result is already selected it must be explicitly selected to set value
                chooseCallbackResult(testData.customCallbackName, testData.mockResultName)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.customCallbackName)
            })

            after(() => {
                cy.get(s.trainDialog.buttonSave)
                    .click()

                cy.get(s.common.spinner, { timeout: constants.spinner.timeout })
                    .should('not.exist')
            })
        })
    })

    describe('Editing', () => {
        before(() => {
            cy.get(s.trainDialogs.descriptions)
                .contains(testData.dialogInputs.noCallbackResult)
                .click('left')
        })

        describe('Activity Selection', () => {
            it('selecting activity where no Callback Result was chosen should show None', () => {
                cy.get(s.webChat.messageFromBot)
                    .eq(0)
                    .click()

                cy.get(s.webChat.callbackResultName)
                    .contains(testData.callback.mockResults.none)
            })

            it('selecting activity where Callback Result was chosen should show name of Result', () => {
                cy.get(s.webChat.messageFromBot)
                    .eq(2)
                    .click()

                cy.get(s.webChat.callbackResultName)
                    .contains(testData.callback.mockResults.setAllEntities)

                cy.get(s.trainDialog.memory.entityName)
                    .should($entitiesNames => {
                        const entityNames = $entitiesNames.map((i, el) => Cypress.$(el).text()).get()
                        expect(entityNames.sort()).to.deep.eq([...testData.entityNames].sort())
                    })
            })
        })

        describe('Action Replacement', () => {
            it('given different result selected action can be changed', () => {
                cy.get(s.webChat.messageFromBot)
                    .eq(2)
                    .click()

                // TODO: Dropdown option was 0x0 pixels? Not sure if this is needed to fix
                cy.get(s.trainDialog.actionScorer.callbackName)
                    .contains(testData.callback.name)
                    .scrollIntoView()

                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearAllEntities)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name, true)

                cy.get(s.webChat.messageFromBot)
                    .eq(4)
                    .click()

                cy.get(s.trainDialog.memory.entityName)
                    .should('not.exist')
            })
        })
    })
})

function chooseCallbackResult(callbackName: string, callbackResultName: string) {
    cy.get(s.trainDialog.actionScorer.callbackName)
        .contains(callbackName)
        .parents(s.trainDialog.actionScorer.rowField)
        .then($actionScorerRow => {
            cy.get(s.trainDialog.actionScorer.callbackResultSelectorDropdown, { withinSubject: $actionScorerRow })
                .click()

            cy.get(s.common.dropDownOptions)
                .contains(callbackResultName)
                .click()
        })
}

function getEntityValue(entityName: string, valueIndex: number) {
    return cy.get(s.callbackResultModal.entityName)
        .contains(entityName)
        .next(s.callbackResultModal.valuesList)
        .find(s.callbackResultModal.value)
        .eq(valueIndex)
}

function getAddValue(entityName: string) {
    return cy.get(s.callbackResultModal.entityName)
        .contains(entityName)
        .next(s.callbackResultModal.valuesList)
        .find(s.callbackResultModal.buttons.addValue)
}

function getRemoveEntityValueButton(entityName: string, valueIndex: number) {
    return cy.get(s.callbackResultModal.entityName)
        .contains(entityName)
        .next(s.callbackResultModal.valuesList)
        .find(s.callbackResultModal.buttons.removeValue)
        .eq(valueIndex)
}