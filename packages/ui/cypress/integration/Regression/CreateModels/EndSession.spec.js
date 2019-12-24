/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as models from '../../../support/Models'
import * as modelPage from '../../../support/components/ModelPage'
import * as actions from '../../../support/Actions'
import * as trainDialogsGrid from '../../../support/components/TrainDialogsGrid'
import * as train from '../../../support/Train'
import * as helpers from '../../../support/Helpers'

const preliminaryTrainingDescription = 'Preliminary Training to cause some expected behaviors in future Train Dialogs'

describe('End Session - Create Model', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)

  context('Should create a new model', () => {
    it('Create a model to test against', () => {
      models.CreateNewModel('z-EndSession')
    })

    it('Should create three Actions', () => {
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: "Hello" })
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: "Okay" })
      actions.CreateNewActionThenVerifyInGrid({ type: 'END_SESSION', responseNameData: "Goodbye" })
    })
  })

  context('1st Train Dialog', () => {
    it('Should create a new Train Dialog', () => {
      modelPage.NavigateToTrainDialogs()
      cy.WaitForTrainingStatusCompleted()
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should train model to respond to "Hi"', () => {
      train.TypeYourMessage('Hi')
      train.ClickScoreActionsButton()
      train.SelectTextAction('Hello')
    })

    it('Should train model to respond to "Yo"', () => {
      train.TypeYourMessage('Yo')
      train.ClickScoreActionsButton()
      train.SelectTextAction('Okay')
    })

    it('Should add a description and save the Train Dialog', () => {
      train.TypeDescription(preliminaryTrainingDescription)
      train.SaveAsIsVerifyInGrid()
    })

    // IMPORTANT! - Keep this stage of the test here before we add in the End Session Bot response.
    // There was a bug where the End Session Bot response caused the edited TD to lose its description and be saved
    // as a second TD rather than overwriting the edited TD and retaining the description as it should have done.
    it('Should be able to edit the training that we just saved and find the description we gave it', () => {
      cy.WaitForTrainingStatusCompleted()
      trainDialogsGrid.TdGrid.EditTrainingByChatInputs('Hi', 'Yo', 'Okay')
      train.VerifyDescription(preliminaryTrainingDescription)
    })

    it('Should train model to respond to "Bye"', () => {
      train.TypeYourMessage('Bye')
      train.ClickScoreActionsButton()
      train.SelectEndSessionAction('Goodbye')
    })

    it('Verify that selecting the EndSession Bot response did not remove the description', () => {
      train.VerifyDescription(preliminaryTrainingDescription)
    })

    it('Should save the Train Dialog and verifies that we still have only 1 Train Dialog and that the description persisted', () => {
      train.SaveAsIsVerifyInGrid()
      trainDialogsGrid.VerifyDescriptionForRow(0, preliminaryTrainingDescription)
    })
  })

  context('2nd Train Dialog', () => {
    it('Should create another Train Dialog', () => {
      cy.WaitForTrainingStatusCompleted()
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should train model to respond to "Yo"', () => {
      train.TypeYourMessage('Yo')
      train.ClickScoreActionsButton()
      train.SelectTextAction('Okay')
    })

    it('Should train model to respond to "Bye"', () => {
      train.TypeYourMessage('Bye')
      train.ClickScoreActionsButton()
      train.SelectEndSessionAction('Goodbye')
    })

    it('Should save the Train Dialog', () => {
      train.SaveAsIsVerifyInGrid()
    })
  })
})
