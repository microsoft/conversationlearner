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

describe('Wait vs. Non Wait Actions - CreateModels', () => {
  afterEach(helpers.SkipRemainingTestsOfSuiteIfFailed)

  context('Setup', () => {
    it('Should create a model to test against', () => {
      models.CreateNewModel('z-waitNoWait')
    })
  })

  context('Create Actions', () => {
    it('Should create 1 Wait Action', () => {
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: 'Which animal would you like?' })
    })

    it('Should create 3 Non-Wait Actions', () => {
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: 'Cows say moo!', uncheckWaitForResponse: true })
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: 'Ducks say quack!', uncheckWaitForResponse: true })
      actions.CreateNewActionThenVerifyInGrid({ responseNameData: 'Fish just swim.', uncheckWaitForResponse: true })
    })

    it('Should create 1 END_SESSION Action, try to make it a Non-Wait Action, verify that UI overrides and creates it as a Wait Action', () => {
      actions.CreateNewActionThenVerifyInGrid({ type: 'END_SESSION', responseNameData: "That's All Folks.", uncheckWaitForResponse: true })
    })
  })

  context('Train Dialog', () => {
    it('Should create a new Train Dialog', () => {
      modelPage.NavigateToTrainDialogs()
      cy.WaitForTrainingStatusCompleted()
      trainDialogsGrid.TdGrid.CreateNewTrainDialog()
    })

    it('Should be able to select a Wait action after selecting a Non-Wait Action', () => {
      train.TypeYourMessage('Duck')
      train.ClickScoreActionsButton()
      train.SelectTextAction('Ducks say quack!')
      train.SelectTextAction('Which animal would you like?')
    })

    it('Should be able to select a Wait action after selecting a different Non-Wait Action', () => {
      train.TypeYourMessage('Fish')
      train.ClickScoreActionsButton()
      train.SelectTextAction('Fish just swim.')
      train.SelectTextAction('Which animal would you like?')
    })

    it('Should be able save the Train Dialog and find it in the grid', () => {
      train.SaveAsIsVerifyInGrid()
    })

    // Manually EXPORT this to fixtures folder and name it 'z-waitNoWait.cl'
  })
})