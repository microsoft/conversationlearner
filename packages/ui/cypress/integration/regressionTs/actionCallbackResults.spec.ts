import * as util from '../../support/utilities'
import constants from '../../support/constants'
import s from '../../support/selectors'

describe('Action Callback Results', () => {
    const testData = {
        modelName: 'CallbackResults',
        modelFile: 'actionCallbackResults.cl',
        callback: {
            name: 'Callback Results Types',
            mockResults: {
                none: 'None',
                setValues: 'Set values 1',
                clearValues: 'Clear Values',
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
    }

    before(() => {
        cy.visit(`/`)
        util.importModel(testData.modelName, testData.modelFile)
        // Wait for training status to change. Sometimes training is fast and we can't rely on catching the transition to running status. Assume it happens and only ensure it's settled at completed.
        cy.wait(3000)
        cy.get(s.trainingStatus.completed, { timeout: constants.training.timeout })
        // Train
    })

    describe('Action Modal', () => {
        before(() => {
            cy.get(s.model.buttonNavActions)
                .click()
            cy.get(s.actions.callbackName)
                .contains(testData.callback.name)
                .click()
        })

        it('should show each results on modal', () => {
            cy.get(s.action.callbackResultName)
                .should('have.length', 2)
                .first()
                .parents(s.action.callbackResultRow)
                .find(s.action.callbackResultButton)
                .click()

            cy.get(s.callbackResultModal.title)

            cy.get(s.callbackResultModal.buttonOk)
                .click()
        })

        it('should show help panel when header is clicked', () => {
            cy.get(s.action.helpIconCallbackResult)
                .click()
                .wait(500)

            cy.get(s.helpPanel.buttonClose)
                .click()
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

            it('select action WITHOUT selecting callback result should invoke callback', () => {
                util.inputText(testData.dialogInputs.noCallbackResult)
                util.clickScoreActionButton()
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                // Verify each entity is set in memory
                // TODO: Should also verify values, but their random, existence is good enough
                cy.get(s.trainDialog.memory.entityName)
                    .should($entitiesNames => {
                        const entityNames = $entitiesNames.map((i, el) => Cypress.$(el).text()).get()
                        expect(entityNames.sort()).to.deep.eq([...testData.entityNames].sort())
                    })
            })

            it('select action WITH Callback Result selected should simulate result', () => {
                util.inputText(`Chose 'Set Values' Result`)
                util.clickScoreActionButton()

                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.setValues)
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

            it('select action with Callback Results which REMOVES entities should effect memory', () => {
                util.inputText(`Chose 'Clear Values' Results`)
                util.clickScoreActionButton()
                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearValues)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                // Have to enter another round to verify clearing effects
                util.inputText('Verify Memory Empty')
                util.clickScoreActionButton()
                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearValues)
                util.selectAction(s.trainDialog.actionScorer.callbackName, testData.callback.name)

                cy.get(s.trainDialog.memory.entityName)
                    .should('not.exist')
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
                .click()
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
                    .contains(testData.callback.mockResults.setValues)

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

                chooseCallbackResult(testData.callback.name, testData.callback.mockResults.clearValues)
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
        .then(() => {
            util.selectDropDownOption(s.trainDialog.actionScorer.callbackResultSelectorDropdown, callbackResultName)
        })
}