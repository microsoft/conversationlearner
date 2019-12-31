/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as popupModal from './PopupModal'
import * as helpers from '../Helpers'

export function ClickEntityType(type) { cy.Get(`button.ms-Dropdown-item[title="${type}"]`).Click() }
export function TypeEntityName(entityName) { cy.Get('[data-testid="entity-creator-entity-name-text"]').type(entityName) }
export function ClickEntityTypeDropdown() { cy.Get('[data-testid="entity-creator-entity-type-dropdown"]').Click() }
export function VerifyEntityTypeDisabled() { cy.Get('[aria-disabled="true"][data-testid="entity-creator-entity-type-dropdown"]') }
export function ClickCreateButton() { cy.Get('[data-testid="entity-creator-button-save"]').Click() }
export function ClickDeleteButton() { cy.Get('[data-testid="entity-button-delete"]').Click() }
export function ClickTrainDialogFilterButton() { cy.Get('[data-testid="entity-creator-component-train-dialog-filter-button"]').Click() }
export function ClickCancelButton() { cy.Get('[data-testid="entity-button-cancel"]').Click() }

export function ClickMultiValueCheckbox() { cy.Get('[data-testid="entity-creator-multi-valued-checkbox"] i[data-icon-name="CheckMark"]').Click() }
export function ClickNegatableCheckbox() { cy.Get('[data-testid="entity-creator-negatable-checkbox"] i[data-icon-name="CheckMark"]').Click() }

export function ClickOkButtonOnNoteAboutPreTrained() { popupModal.VerifyContentAnyTitleClickButton('pre-trained Entity', '[data-testid="confirm-cancel-modal-ok"]') }

export function SelectRequiredForActionsTab() { cy.Get('button[data-content="Required For Actions"]').Click() }
export function SelectBlockedActionsTab() { cy.Get('button[data-content="Blocked Actions"]').Click() }

export function ClickConfirmButtonOnDeleteConfirmPopUp() { popupModal.VerifyExactTitleNoContentClickButton('Are you sure you want to delete this Entity?', '[data-testid="confirm-cancel-modal-accept"]') }
export function ClickCancelButtonOnDeleteConfirmPopUp() { popupModal.VerifyExactTitleNoContentClickButton('Are you sure you want to delete this Entity?', '[data-testid="confirm-cancel-modal-cancel"]') }
export function ClickConfirmButtonOnDeleteConfirmWithWarningPopUp() { popupModal.VerifyExactTitleAndContentContainsClickButton('Are you sure you want to delete this Entity?', 'This Entity is used by one or more Training Dialogs.', '[data-testid="confirm-cancel-modal-accept"]') }
export function ClickCancelButtonOnDeleteConfirmWithWarningPopUp() { popupModal.VerifyExactTitleAndContentContainsClickButton('Are you sure you want to delete this Entity?', 'This Entity is used by one or more Training Dialogs.', '[data-testid="confirm-cancel-modal-cancel"]') }
export function ClickCancelButtonOnUnableToDeletePopUp() { popupModal.VerifyExactTitleAndContentContainsClickButton('Unable to Delete this Entity', 'referenced within the bot response', '[data-testid="confirm-cancel-modal-cancel"]') }

export function SelectResolverType(resolverType) {
  cy.Get('[data-testid="entity-creator-resolver-type-dropdown"]').Click()

  cy.Get('div.ms-Dropdown-items[role="listbox"] > button.ms-Dropdown-item > span > div > span.clDropdown--normal')
    .ExactMatch(resolverType)
    .parents('button.ms-Dropdown-item')
    .Click()
}

export function VerifyEmptyGrid() {
  cy.Enqueue(() => {
    const gridRowCount = Cypress.$('[data-testid="entity-creator-modal"]').parent().find('[data-automationid="ListCell"]').length
    helpers.ConLog('VerifyEmptyGrid', `gridRowCount: ${gridRowCount}`)
    if (gridRowCount != 0) {
      throw new Error(`Expecting the grid to be empty, instead we found ${gridRowCount} rows in it.`)
    }
  })
}

export function TypeEnumValues(enumValues) {
  cy.Get('[data-testid="entity-enum-value-value-name"]').then(elements => {
    for (let i = 0; i < enumValues.length; i++) {
      cy.wrap(elements[i]).type(`${enumValues[i]}{enter}`)
    }
  })
}

// Originally we had these two functions (commented out below) to do this work but we hit a bug where the dropdown
// did not stay stable. It would appear and then go away...only when testing under the Electron browser.
// We never could figure out the cause, so instead we came up with this more complex way to deal with this situation.
// export function ClickEntityTypeDropdown() { cy.Get('[data-testid="entity-creator-entity-type-dropdown"]').Click() }
// export function ClickEntityType(type) { cy.Get(`button.ms-Dropdown-item[title="${type}"]`).Click() }
export function SelectEntityType(type) {
  const funcName = `SelectEntityType(${type})`
  let state = 'drop'
  cy.WaitForStableDOM()
  cy.RetryLoop(() => {
    if (state == 'drop') {
      // This part verifies that the Entity Type is set to the value we want, 
      // and if not it clicks on the element to cause the drop down to show up.
      helpers.ConLog(funcName, 'state: drop')
      const elements = Cypress.$('[data-testid="entity-creator-entity-type-dropdown"]')
      helpers.ConLog(funcName, `elements.length: ${elements.length}`)
      if (elements.length != 1) {
        throw new Error('Failed to find the Entity Creator Dropdown.')
      }
      const text = helpers.TextContentWithoutNewlines(elements[0])
      if (text == type) {
        helpers.ConLog(funcName, `Selected Entity Type is: '${text}'`)
        return
      }
      elements[0].click()

      state = 'select'
      throw new Error('Retrying to give the UI a chance to update so we can move on to the next state.')
    }

    // This part selects from the drop down list...if it hasn't disappeared. ------------------------------
    helpers.ConLog(funcName, 'state: select')

    // Whatever happens here, we will need to return to the drop state to
    // either confirm or trigger the drop down list to show up again.
    state = 'drop'

    const elements = Cypress.$(`button.ms-Dropdown-item[title="${type}"]`)
    if (elements.length != 1) {
      helpers.ConLog('Did not find either the dropdown list or the type we are looing for.')
      throw new Error('Failed to find the type to select.')
    }
    elements[0].click()

    throw new Error(`Retrying to confirm we have the Entity Type of '${type}' that we just selected.`)
  })
}