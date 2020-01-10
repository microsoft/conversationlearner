/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as models from '../../../support/Models'
import * as modelPage from '../../../support/components/ModelPage'
import * as chatPanel from '../../../support/components/ChatPanel'
import * as trainDialogsGrid from '../../../support/components/TrainDialogsGrid'
import * as train from '../../../support/Train'
import * as entityDetectionPanel from '../../../support/components/EntityDetectionPanel'
import * as helpers from '../../../support/Helpers'

// SKIPPING this test due to Bug 2389: Entity Detection stutters as it repeats the user's utterance many times

// This test suite is part 1 of 2. The second part is in ApiVerifyMultipleExceptions.
describe('API Create Multiple Exceptions - ErrorHandling', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)

  context('Setup', () => {
    it('Should import a model to test against and navigate to Train Dialogs view', () => {
      models.ImportModel('z-ApiMultExceptns', 'z-ApiCallbacks.cl')
      modelPage.NavigateToTrainDialogs()
    })
  })

  context('Train Dialog that will be Discarded by an Error', () => {
    it('Should create a new Train Dialog', () => {
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should add a user turn to cause an error, dismiss the error and the TD and verify it returns to the TD grid pane view', () => {
      train.TypeYourMessage('This entityError will cause the Train Dialog to be discarded.')
      entityDetectionPanel.LabelTextAsEntity('entityError', 'entityError')
      train.ClickScoreActionsButton()
      train.VerifyErrorPopup("Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.")
      train.ClickPopupConfirmCancelOkButton()
      trainDialogsGrid.VerifyPageTitle()
    })

    it('Wait for Training Status to be complete due to bug 2316', () => {
      // Bug 2316: TDs with EntityDetectionCallback Errors should NOT be part of the training since they are discarded
      // This TD should not influence the next TD that is created since it is being discarded.
      // However, bug 2316 shows that at least sometimes this Training does have an influence on the next training
      // and it should not.
      cy.WaitForTrainingStatusCompleted()
    })
  })

  context('Train Dialog that will be Saved', () => {
    it('Should create a new Train Dialog', () => {
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should add a user turn to be used later to cause an EntityDetectionCallback error and verify it is in the chat pane', () => {
      train.TypeYourMessage('This can be an entityError')
      train.ClickScoreActionsButton()
      train.SelectApiTextAction('ExceptionAPI', 'ExceptionAPI: Hello with no exception')
    })

    it('Should add a logicError turn and verify it renders a card with an error message in the chat pane', () => {
      train.TypeYourMessage('This is a logicError')
      entityDetectionPanel.LabelTextAsEntity('logicError', '+logicError')
      train.ClickScoreActionsButton()
      train.SelectApiCardAction('ExceptionAPI', 'Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Logic Error')
    })

    it('Should add a turn to remove the logicError and verify it renders a NON-error message', () => {
      train.TypeYourMessage('Remove the logicError')
      entityDetectionPanel.LabelTextAsEntity('logicError', '-logicError')
      train.ClickScoreActionsButton()
      train.SelectApiTextAction('ExceptionAPI', 'ExceptionAPI: Hello with no exception')
    })

    it('Should add a user turn to be used later to cause an EntityDetectionCallback error and verify it is in the chat pane', () => {
      train.TypeYourMessage('Can be used to cause an entityError')
      train.ClickScoreActionsButton()
      train.SelectApiTextAction('ExceptionAPI', 'ExceptionAPI: Hello with no exception')
    })

    it('Should add a round with a TEXT Action to later test bug 2151', () => {
      train.TypeYourMessage('Expecting TEXT Action: Test Bug 2151 to make sure that fixing an Exception thrown in the EntityDetectionCallback function cause the TEXT Action to render without error.')
      train.ClickScoreActionsButton()
      train.SelectTextAction('This is a TEXT ACTION')
    })

    it('Should add a renderError turn and verify it renders a card with an error message in the chat pane', () => {
      train.TypeYourMessage('This will produce a renderError')
      entityDetectionPanel.LabelTextAsEntity('renderError', '+renderError')
      train.ClickScoreActionsButton()
      train.SelectApiCardAction('ExceptionAPI', 'Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Render Error')
    })

    it('Should add a logicError turn again and verify the error message is for the logicError, not the renderError', () => {
      train.TypeYourMessage('This is a logicError')
      entityDetectionPanel.LabelTextAsEntity('logicError', '+logicError', 0, false)
      train.ClickScoreActionsButton()
      train.SelectApiCardAction('ExceptionAPI', 'Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Logic Error')
    })

    it('Should add a user turn to be used later to fix an EntityDetectionCallback error and verify it is in the chat pane', () => {
      train.TypeYourMessage('Expecting TEXT Action: Remove an entityError')
      train.ClickScoreActionsButton()
      train.SelectTextAction('This is a TEXT ACTION')
    })

    it('Should add a turn to remove the logicError and verify it renders the error message for renderError once again', () => {
      train.TypeYourMessage('Remove the logicError, however, you will still see the renderError.')
      entityDetectionPanel.LabelTextAsEntity('logicError', '-logicError', 0, false)
      train.ClickScoreActionsButton()
      train.SelectApiCardAction('ExceptionAPI', 'Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Render Error')
    })

    it('Should add a turn to remove the renderError and verify it renders a NON-error message', () => {
      train.TypeYourMessage('Clear out the renderError. At this point you should no longer see errors.')
      entityDetectionPanel.LabelTextAsEntity('renderError', '-renderError')
      train.ClickScoreActionsButton()
      train.SelectApiTextAction('ExceptionAPI', 'ExceptionAPI: Hello with no exception')
    })

    it('Should add a user turn with an Entiy error, verify popup, confirm popup, and verify user turn is removed', () => {
      train.TypeYourMessage('This entityError will cause the user turn to be discarded.', undefined, true)
      entityDetectionPanel.LabelTextAsEntity('entityError', 'entityError')
      train.ClickScoreActionsButton()
      train.VerifyErrorPopup("Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.")
      train.ClickPopupConfirmCancelOkButton()
      chatPanel.VerifyChatMessageCount(20)
    })

    it('Should add a user turn, to be used later to cause an error, and verify it is in the chat pane', () => {
      train.TypeYourMessage('An entityError shall go here as well')
      train.ClickScoreActionsButton()
      train.SelectApiTextAction('ExceptionAPI', 'ExceptionAPI: Hello with no exception')
    })

    it('More to do here - waiting for fix for Bug 2136: API Errors not behaving like other errors', () => {
    })

    it('Should save the training and verify it is in the grid', () => {
      train.SaveAsIsVerifyInGrid()
    })
  })

  // Manually EXPORT this to fixtures folder and name it 'z-ApiMultExceptns.cl'
})
