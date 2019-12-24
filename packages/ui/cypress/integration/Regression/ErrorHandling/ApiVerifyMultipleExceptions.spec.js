/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as models from '../../../support/Models'
import * as modelPage from '../../../support/components/ModelPage'
import * as entityDetectionPanel from '../../../support/components/EntityDetectionPanel'
import * as chatPanel from '../../../support/components/ChatPanel'
import * as trainDialogsGrid from '../../../support/components/TrainDialogsGrid'
import * as train from '../../../support/Train'
import * as helpers from '../../../support/Helpers'

// This test suite is part 1 of 2. The second part is in ApiCreateMultipleExceptions.
describe('API Verify Multiple Exceptions - ErrorHandling', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)

  context('Setup', () => {
    it('Should import a model to test against and navigate to Train Dialogs view', () => {
      models.ImportModel('z-ApiMultExceptns', 'z-ApiMultExceptns.cl')
      modelPage.NavigateToTrainDialogs()
    })
  })

  context('Edit the Train Dialog to Verify the Errors Persisted', () => {
    it('Should edit the Train Dialog that was persisted', () => {
      trainDialogsGrid.TdGrid.EditTrainingByChatInputs('This can be an entityError', 'An entityError shall go here as well', 'ExceptionAPI')

      // Bug 2137: Render Error appears to be lost when editing an existing Train Dialog
      // When this bug is fixed remove these comments and the line below.
      train.ClickReplayButton()
    })

    it('Should verify that all Bot responses persisted correctly', () => {
      VerifyAllBotChatMessages()
    })

    it('Should introduce an Entity detection error at the last Bot turn and verify it', () => {
      chatPanel.SelectChatTurnExactMatch('An entityError shall go here as well')
      entityDetectionPanel.LabelTextAsEntity('entityError', 'entityError')
      train.ClickSubmitChangesButton()
      VerifyAllBotChatMessages(true)
    })

    it('Should remove the Entity detection error at the last Bot turn and verify it', () => {
      chatPanel.SelectChatTurnExactMatch('An entityError shall go here as well')
      entityDetectionPanel.RemoveEntityLabel('entityError', 'entityError')
      train.ClickSubmitChangesButton()
      VerifyAllBotChatMessages()
    })

    it('Should introduce an Entity detection error at the first Bot turn and verify it affects all Bot responses', () => {
      chatPanel.SelectChatTurnExactMatch('This can be an entityError')
      entityDetectionPanel.LabelTextAsEntity('entityError', 'entityError')
      train.ClickSubmitChangesButton()
      VerifyAllBotChatMessagesAreForEntityDetectionCallback()
    })

    it('Should remove the Entity detection error at the first Bot turn and verify it', () => {
      chatPanel.SelectChatTurnExactMatch('This can be an entityError')
      entityDetectionPanel.RemoveEntityLabel('entityError', 'entityError')
      train.ClickSubmitChangesButton()
      VerifyAllBotChatMessages(undefined, true)
    })

    it('Should abandon the edit', () => {
      train.AbandonDialog()
    })

    it('More to do here - waiting for fix for Bug 2136: API Errors not behaving like other errors', () => {
    })
  })
})

// Bug 2142: TEST BLOCKER - API Callback error rendering is different between original TD rendering and when editing a Train Dialog
// Once this bug is fixed the calls to "VerifyCardChatMessage" will fail due to the first parameter needing to be changed.
function VerifyAllBotChatMessages(endsWithEntityDetectionError, bug2151HasBeenTriggered) {
  let botIndex = -1
  function NextBotIndex() { botIndex += 2; return botIndex; }

  chatPanel.VerifyTextChatMessage('ExceptionAPI: Hello with no exception', NextBotIndex())
  chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Logic Error', NextBotIndex())
  chatPanel.VerifyTextChatMessage('ExceptionAPI: Hello with no exception', NextBotIndex())
  chatPanel.VerifyTextChatMessage('ExceptionAPI: Hello with no exception', NextBotIndex())

  if (bug2151HasBeenTriggered) {
    chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback:', "Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.", NextBotIndex())
  } else {
    chatPanel.VerifyTextChatMessage('This is a TEXT ACTION', NextBotIndex())
  }
  chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Render Error', NextBotIndex())
  chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Logic Error', NextBotIndex())

  if (bug2151HasBeenTriggered) {
    chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback:', "Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.", NextBotIndex())
  } else {
    chatPanel.VerifyTextChatMessage('This is a TEXT ACTION', NextBotIndex())
  }

  chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', 'Error: ExceptionAPI: Render Error', NextBotIndex())
  chatPanel.VerifyTextChatMessage('ExceptionAPI: Hello with no exception', NextBotIndex())

  if (endsWithEntityDetectionError) {
    chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', "Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.", NextBotIndex())
  } else {
    chatPanel.VerifyTextChatMessage('ExceptionAPI: Hello with no exception', NextBotIndex())
  }
}

function VerifyAllBotChatMessagesAreForEntityDetectionCallback() {
  for (let i = 1; i <= 15; i += 2) {
    if (i == 9 || i == 15) {
      chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback:', "Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.", i)
    } else {
      chatPanel.VerifyCardChatMessage('Exception hit in Bot’s API Callback: ‘ExceptionAPI’', "Error in Bot's EntityDetectionCallback:  An intentional error was invoked in the EntityDetectionCallback function.", i)
    }
  }
}