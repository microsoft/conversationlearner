/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as models from '../../../support/Models'
import * as modelPage from '../../../support/components/ModelPage'
import * as chatPanel from '../../../support/components/ChatPanel'
import * as trainDialogsGrid from '../../../support/components/TrainDialogsGrid'
import * as train from '../../../support/Train'
import * as common from '../../../support/Common'
import * as actions from '../../../support/Actions'
import * as scorerModal from '../../../support/components/ScorerModal'
import * as helpers from '../../../support/Helpers'

describe('Missing Action - ErrorHandling', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)

  context('Setup', () => {
    it('Should import a model and wait for training to complete', () => {
      models.ImportModel('z-missingAction', 'z-whatsYourName.cl')
      modelPage.NavigateToTrainDialogs()
      cy.WaitForTrainingStatusCompleted()
    })

    it('Should verify there are no error icons on the page', () => {
      modelPage.VerifyNoErrorTriangleOnPage()
    })

    it('Should complete and save a simple 1 action Train Dialog', () => {
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
      train.TypeYourMessage(common.gonnaDeleteAnAction)
      train.ClickScoreActionsButton()
      train.SelectTextAction(common.whatsYourName)
      train.SaveAsIsVerifyInGrid()
    })
  })

  context('Action', () => {
    it('Should delete the action we just used in the Train Dialog', () => {
      modelPage.NavigateToActions()
      actions.DeleteActionThatIsUsedByATrainDialog(common.whatsYourName)
    })
  })

  context('Train Dialogs Grid', () => {
    it('Should verify there are now error icons showing in the Train Dialog grid', () => {
      modelPage.NavigateToTrainDialogs()
      modelPage.VerifyErrorTriangleForTrainDialogs()
      trainDialogsGrid.VerifyIncidentTriangleFoundInTrainDialogsGrid(common.gonnaDeleteAnAction, common.gonnaDeleteAnAction, '', '', '', 1)
    })
  })

  context('Train', () => {
    it('Should edit the Train Dialog and verify the expected error messages show up', () => {
      trainDialogsGrid.TdGrid.EditTrainingByChatInputs(common.gonnaDeleteAnAction, common.gonnaDeleteAnAction, '')
      train.VerifyErrorMessage(common.trainDialogHasErrorsMessage)

      chatPanel.SelectChatTurnStartsWith("ERROR: Can't find Action Id")
      train.VerifyErrorMessage('Action does not exist')
      scorerModal.VerifyMissingActionNotice()
    })

    it('Should create a new action from Train Dialog which should also correct the error in the Train Dialog', () => {
      scorerModal.ClickAddActionButton()
      actions.CreateNewAction({ responseNameData: common.whatsYourName, expectedEntity: 'name' })
      train.VerifyNoErrorMessage()
      train.ClickSaveCloseButton()
      modelPage.VerifyNoErrorTriangleOnPage()
    })
  })
})