/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as actionModal from '../support/components/ActionModal'
import * as actionsGrid from '../support/components/ActionsGrid'
import * as modelPage from '../support/components/ModelPage'
import * as helpers from '../support/Helpers'

// ------------------------------------------------------------------------------------------------
// The UI automatically populates the Required Entities field with entities found in the response 
// text and it also automatically populates the Disqualtifying Entities field with the expected 
// entities, so the caller only needs to specify the ones the UI does not auto populate.
// However, there are cases where the caller may want to explicitly specify these autopopulated 
// values anyway, and this code DOES allow you to do that.

export function CreateNewAction({
  responseNameData, // TEXT-response, API-name, CARD-full-details, END_SESSION-data - Used by create operation
  expectedEntity,
  requiredEntities,
  disqualifyingEntities,
  uncheckWaitForResponse,
  logicArgs,  // provide an array of strings
  renderArgs, // provide an array of strings
  title,
  image,
  line1,
  line2,
  line3,
  button1,
  button2,
  type = 'TEXT'
}) {
  // We do this first since we had a bug (1910) where it is not reset by the UI when
  // type END_SESSION is selected...thus doing it this way ensures the bug fix does
  // not regress.
  if (uncheckWaitForResponse) actionModal.UncheckWaitForResponse()

  actionModal.SelectType(type)

  // These are in a specific order so as to allow explicitly specifying these entities/conditions
  // and for that to not be interfered with by the mechanisim in the UI that sets them automatically.
  //
  // You can still test the automatic setting of these fields by not explicitly setting the arguments
  // of those that should be automatically set.
  if (disqualifyingEntities) actionModal.SelectDisqualifyingEntities(disqualifyingEntities)
  if (expectedEntity) actionModal.SelectExpectedEntity(expectedEntity)
  if (requiredEntities) actionModal.SelectRequiredEntities(requiredEntities)

  switch (type) {
    case 'TEXT':
    case 'END_SESSION':
      actionModal.TypeResponse(responseNameData)
      break

    case 'API':
      actionModal.SelectApi(responseNameData)
      if (logicArgs) actionModal.TypeApiLogicArgs(logicArgs)
      if (renderArgs) actionModal.TypeApiRenderArgs(renderArgs)
      break

    case 'CARD':
      actionModal.SelectCard(responseNameData)
      if (title) actionModal.TypeCardTitle(title)
      if (image) actionModal.TypeCardImage(image)
      if (line1) actionModal.TypeCardLine1(line1)
      if (line2) actionModal.TypeCardLine2(line2)
      if (line3) actionModal.TypeCardLine3(line3)
      if (button1) actionModal.TypeCardButton1(button1)
      if (button2) actionModal.TypeCardButton2(button2)
      break
  }

  actionModal.ClickCreateSaveButton()
}

export function CreateNewActionThenVerifyInGrid({
  responseNameData, // TEXT-response, API-name, CARD-full-details, END_SESSION-data - Used by create operation
  expectedEntity,
  requiredEntities,
  disqualifyingEntities,
  uncheckWaitForResponse,
  logicArgs,  // provide an array of strings
  renderArgs, // provide an array of strings
  title,
  image,
  line1,
  line2,
  line3,
  button1,
  button2,
  type = 'TEXT',
  validateApiResponse  // The easiest way to get this is from the logs after a test run...search for 'VerifyApi'
}) {
  modelPage.NavigateToActions()
  actionsGrid.ClickNewAction()

  CreateNewAction(arguments[0])

  const joined = (responseNameData ? responseNameData : '') + (logicArgs ? logicArgs.join() : '') + (renderArgs ? renderArgs.join() : '')
  const requiredEntitiesFromResponse = ExtractEntities(joined)

  if (validateApiResponse) { responseNameData = validateApiResponse }
  responseNameData = responseNameData.replace(/{enter}/g, '')

  // Get the row that we are going to validate and assign a Cypress Alias to it.
  // If we skip this step, the validations that follow will fail.
  let actionsGridRow = new actionsGrid.Row(type, responseNameData)

  //if (validateApiResponse) actionsGridRow.VerifyApi(validateApiResponse)
  actionsGridRow.VerifyActionType(type)
  actionsGridRow.VerifyRequiredEntities(requiredEntitiesFromResponse, requiredEntities)
  actionsGridRow.VerifyDisqualifyingEntities(expectedEntity, disqualifyingEntities)
  actionsGridRow.VerifyExpectedEntity(expectedEntity)

  // Type END_SESSION must have "Wait for Response" checked even if uncheckWaitForResponse is true.
  actionsGridRow.VerifyWaitForResponse((type === 'END_SESSION') || !uncheckWaitForResponse)
}

// ------------------------------------------------------------------------------------------------

// Input string looks something like this: "Sorry $name{enter}, I can't help you get $want{enter}"
// Returns an array containing entities like this: ['name', 'want']
// ...OR...Returns an empty array if there are no entities in the response string.
function ExtractEntities(response) {
  let entitiesToReturn = []
  let iCurrent = 0

  while (iCurrent < response.length) {
    let iStart = response.indexOf('$', iCurrent)
    if (iStart < 0) break
    iStart++

    let iEnd = response.indexOf('{enter}', iStart)
    if (iEnd < 0) break

    let entityName = response.substring(iStart, iEnd)

    if (!_IsAlphaNumeric(entityName)) iCurrent = iStart
    else {
      entitiesToReturn.push(entityName)
      let length = "{enter}".length
      iCurrent = iEnd + length
    }
  }

  return entitiesToReturn
}

function _IsAlphaNumeric(string) {
  for (let i = 0; i < string.length; i++) {
    const charCode = string.charCodeAt(i)
    if (!(charCode > 47 && charCode < 58) &&  // numeric (0-9)
      !(charCode > 64 && charCode < 91) &&  // upper alpha (A-Z)
      !(charCode > 96 && charCode < 123))   // lower alpha (a-z)
      return false
  }
  return true
}

export function DeleteActionThatIsUsedByATrainDialog(action, actionType = "TEXT") {
  new actionsGrid.Row(actionType, action).EditAction()
  actionModal.ClickDeleteButton()
  actionModal.ClickConfirmDeleteWithWarningButton()
}