/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as models from '../../../support/Models'
import * as modelPage from '../../../support/components/ModelPage'
import * as memoryTableComponent from '../../../support/components/MemoryTableComponent'
import * as scorerModal from '../../../support/components/ScorerModal'
import * as entityDetectionPanel from '../../../support/components/EntityDetectionPanel'
import * as trainDialogsGrid from '../../../support/components/TrainDialogsGrid'
import * as train from '../../../support/Train'
import * as common from '../../../support/Common'
import * as helpers from '../../../support/Helpers'

// This "Expected Entity Labeling" test scenario is Part 1 and
// the "Learned Entity Labeling" test scenario is Part 2 in that 
// it continues from where this test case left off by using the
// model created by this test scenario.
describe('Expected Entity Labeling', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)
  let generatedScoreActionsData = new scorerModal.GeneratedData('expectedEntityLabeling.json')

  context('Setup', () => {
    it('Should import a model to test against, navigate to Train Dialogs view and wait for training status to complete', () => {
      models.ImportModel('z-expectedEntLabl', 'z-whatsYourName.cl')
      modelPage.NavigateToTrainDialogs()
      cy.WaitForTrainingStatusCompleted()
    })
  })

  context('Train Dialog - 1st Round', () => {
    it('Should create a new Train Dialog', () => {
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should type in a user utterance and click Score Actions button', () => {
      train.TypeYourMessage('Hello')
      train.ClickScoreActionsButton()
    })

    generatedScoreActionsData.VerifyScoreActionsList()

    it('Should select an action', () => {
      train.SelectTextAction(common.whatsYourName)
    })
  })

  context('Train Dialog - 2nd Round', () => {
    it('Should type in another user utterance, verify it was labeled as the "name" entity and click Score Actions button', () => {
      train.TypeYourMessage('David', [{ text: 'David', entity: 'name' }])
      entityDetectionPanel.VerifyTextIsLabeledAsEntity('David', 'name')
      train.ClickScoreActionsButton()
    })

    it('Should verify the "name" Entity is in memory with its value', () => {
      memoryTableComponent.VerifyNewEntityNameAndValues('name', ['David'])
    })

    generatedScoreActionsData.VerifyScoreActionsList()

    it('Should select an action', () => {
      train.SelectTextAction('Hello David')
    })

    it('Should save the Train Dialog and verify that it shows up in the grid', () => {
      train.SaveAsIsVerifyInGrid()
    })
  })

  generatedScoreActionsData.SaveGeneratedData()
  // Manually EXPORT this to fixtures folder and name it 'z-expectedEntLabl.cl'
})
