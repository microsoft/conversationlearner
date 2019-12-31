/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as helpers from '../Helpers'

export function TypeAlternativeInput(trainMessage) { cy.Get('[data-testid="entity-extractor-alternative-input-text"]').type(`${trainMessage}{enter}`) }

export function ClickEntityDetectionToken(tokenValue) { cy.Get('[data-testid="token-node-entity-value"]').contains(tokenValue).Click() }
export function ClickNewEntityButton() { cy.Get('[data-testid="entity-extractor-create-button"]').Click() }

export const EntityLabelUndoButtonSelector = '[data-testid="undo-changes-button"]'
export function VerifyEntityLabelUndoButtonIsDisabled() { cy.Get(EntityLabelUndoButtonSelector + '.is-disabled') }
export function VerifyEntityLabelUndoButtonIsEnabled() { cy.Get(EntityLabelUndoButtonSelector + ':not(.is-disabled)') }
export function ClickEntityLabelUndoButton() { cy.Get(EntityLabelUndoButtonSelector).Click() }

// expectedEntities is a string segment that you will see in the UI warning message.
export function VerifyDuplicateEntityLabelsWarning(expectedEntities, index = 0) { _VerifyFoundInEntityDetectionPanel(index, `[data-testid="entity-extractor-duplicate-entity-warning"]:contains("Entities that are not multi-value (i.e. ${expectedEntities}) will only store the last labelled utterance")`) }
export function VerifyNoDuplicateEntityLabelsWarning(index = 0) { _VerifyNotFoundInEntityDetectionPanel(index, '[data-testid="entity-extractor-duplicate-entity-warning"]') }

export function VerifyMatchWarning(index = 0) { _VerifyFoundInEntityDetectionPanel(index, '[data-testid="entity-extractor-match-warning"]:contains("Equivalent input must contain the same detected Entities as the original input text.")') }
export function VerifyNoMatchWarning(index = 0) { _VerifyNotFoundInEntityDetectionPanel(index, '[data-testid="entity-extractor-match-warning"]') }

function _VerifyFoundInEntityDetectionPanel(index, selector) {
  cy.RetryLoop(() => {
    if (_FindInEntityDetectionPanel(index, selector).length == 0) {
      throw new Error(`Expected Element not found in Entity Detection Panel at index ${index} - selector: '${selector}'`)
    }
  })
}

function _VerifyNotFoundInEntityDetectionPanel(index, selector) {
  cy.RetryLoop(() => {
    if (_FindInEntityDetectionPanel(index, selector).length > 0) {
      throw new Error(`Expected Element should NOT be found in Entity Detection Panel at index ${index} - selector: '${selector}'`)
    }
  })
}

function _FindInEntityDetectionPanel(index, selector) {
  let elements = _GetEditorContainerForEntityDetectionPanel(index)
  return Cypress.$(elements[0]).find(selector)
}

function _GetEditorContainerForEntityDetectionPanel(index) {
  let elements = Cypress.$('div.slate-editor')
  if (index > elements.length - 1) {
    throw new Error(`GetEditorContainerForEntityDetectionPanel - invalid index: ${index} - maximum index is: ${elements.length - 1} `)
  }

  elements = Cypress.$(elements[index]).parents('div.editor-container')
  if (elements.length != 1) {
    throw new Error(`Did not find the single expected "div.editor-container" element.`)
  }
  return elements
}

// These works whether text is a word or a phrase.
// Currently this only works for the primary user input and NOT the alternative inputs, however,
// it could easily be expanded. Search for "Test_SelectWord" in this code file to see an example
// of how that could be done.
export function VerifyCanLabelTextAsEntity(text) { _VerifyLabelTextAsEntity(text, 'be.visible') }
export function VerifyCanNotLabelTextAsEntity(text) { _VerifyLabelTextAsEntity(text, 'be.hidden') }
function _VerifyLabelTextAsEntity(text, verification) {
  cy.Get('body').trigger('Test_SelectWord', { detail: text })
  cy.Get('[data-testid="entity-picker-entity-search"').should(verification)
}

// 'index' is for the possible alternative inputs, index=0 is for the primary input.
function _IsWordAtInputIndexLabeledAsEntity(word, entity, index = 0) {
  let elements = _GetEditorContainerForEntityDetectionPanel(index)
  return _IsWordLabeledAsEntity(word, entity, elements)
}

// An error is thrown if the 'word' is not found in the text, however if it is not labled
// as expected 'false' is returned.
function _IsWordLabeledAsEntity(word, entity, elements) {
  const funcName = `_IsWordLabeledAsEntity("${word}", "${entity}")`

  // Get the list of elements of the individual words that make up the utterance.
  elements = Cypress.$(elements[0]).find('[data-testid="token-node-entity-value"] > span > span')

  // If you need to find a phrase, this part of the code will fail, 
  // you will need to upgrade this code in that case.
  let wordWasFound = false
  for (let i = 0; i < elements.length; i++) {
    if (helpers.TextContentWithoutNewlines(elements[i]) === word) {
      wordWasFound = true
      if (Cypress.$(elements[i])
        .parents('.cl-entity-node--custom')
        .find(`[data-testid="custom-entity-name-button"]:contains('${entity}')`)
        .length > 0) {
        helpers.ConLog(funcName, `The word "${word} was found and it was labeled as the entity "${entity}"`)
        return true
      }
    }
  }

  if (!wordWasFound) {
    helpers.ConLog(funcName, `The word "${word} was NOT found - Very likely a test code bug`)
    throw new Error(`We could not find '${word}' in the utterance.`)
  }

  helpers.ConLog(funcName, `The word "${word} was found but it was NOT labeled as the entity "${entity}"`)
  return false
}

// Verify that a specific word of a user utterance has been labeled as an entity.
//  word = a word within the utterance that should already be labeled
//  entity = name of entity the word should be labeled with
//  elements = optional array of elements of the input row to search
// *** This does NOT work for phrases. ***
export function VerifyTextIsLabeledAsEntity(word, entity, elements = undefined) {
  cy.log(`Verify that '${word}' is labeled as entity '${entity}'`)
  cy.WaitForStableDOM().then(() => {
    if (!elements) {
      elements = _GetEditorContainerForEntityDetectionPanel(0)
    }

    if (!_IsWordLabeledAsEntity(word, entity, elements)) {
      throw new Error(`The word '${word}' was found, but it does not have the expected '${entity}' Entity label`)
    }
  })
}

// index is for the possible alternative inputs, index=0 is for the primary input.
export function VerifyTextIsNotLabeledAsEntity(text, entity, index = 0) {
  cy.WaitForStableDOM().then(() => {
    if (_IsWordAtInputIndexLabeledAsEntity(text, entity, index)) {
      throw new Error(`In input #${index} we found that "${text}" is labeled as "${entity}" - it should have no label`)
    }
  })
}


// index is for the possible alternative inputs, index=0 is for the primary input.
export function LabelTextAsEntity(text, entity, index = 0, itMustNotBeLabeledYet = true) {
  function LabelIt() {
    // This works whether text is a word or a phrase.
    cy.Get('body').trigger('Test_SelectWord', { detail: { phrase: text, index: index } })
    cy.WaitForStableDOM().then(() => {
      const editorContainerElements = _GetEditorContainerForEntityDetectionPanel(index)
      cy.wrap(editorContainerElements).find('[data-testid="fuse-match-option"]').contains(entity).Click()
    })
  }

  if (itMustNotBeLabeledYet) {
    LabelIt()
  } else {
    // First make sure it is not already labeled before trying to label it.
    cy.WaitForStableDOM().then(() => {
      if (!_IsWordAtInputIndexLabeledAsEntity(text, entity, index)) {
        LabelIt()
      }
    })
  }
}

// SelectEntityLabel and RemoveEntityLabel
// word = a word within the utterance that should already be labeled
// entity = name of entity the word was labeled with
// index = into one of the alternative inputs
// *** This does work for multiple word labels, but you must pass in only one
// *** word that uniquely identifies the labeled text
export function SelectEntityLabel(word, entity, index = 0) {
  cy.WaitForStableDOM().then(() => { return _GetEditorContainerForEntityDetectionPanel(index) }).then(elements => {
    cy.wrap(elements[0]).within(() => {
      // cy.Get('[data-testid="token-node-entity-value"] > span > span')
      //   .contains(word)
      //   .RevealPreviousSubject()

      // cy.Get('[data-testid="token-node-entity-value"] > span > span')
      //   .ExactMatch(word)
      //   .RevealPreviousSubject()

      cy.Get('[data-testid="token-node-entity-value"] > span > span')
        .ExactMatch(word)
        //.contains(word)
        .parents('.cl-entity-node--custom')
        .find('[data-testid="custom-entity-name-button"]')
        .contains(entity)
        .Click()
    })
  })
}

export function RemoveEntityLabel(word, entity, index = 0) {
  SelectEntityLabel(word, entity, index)
  cy.Get('button[title="Unselect Entity"]').Click()
}



export function VerifyWordNotLabeledAsEntity(word, entity, index = 0) {
  cy.RetryLoop(() => {
    if (_IsWordAtInputIndexLabeledAsEntity(word, entity, index)) {
      throw new Error(`The word '${word}' was found, but it should NOT be labeled as '${entity}'`)
    }
  })
}

// Verifies that the user input at index (0=primary, 1-n=alternative) has the
// expected text labeled as entities.
export function VerifyMultipleEntityLabels(textEntityPairs, index) {
  cy.WaitForStableDOM().then(() => {
    const elements = _GetEditorContainerForEntityDetectionPanel(index)
    textEntityPairs.forEach(textEntityPair => VerifyTextIsLabeledAsEntity(textEntityPair.text, textEntityPair.entity, elements))
  })
}



const entityLabelConflictPopupSelector = '[data-testid="entity-conflict-cancel"], [data-testid="entity-conflict-accept"]'
export function VerifyEntityLabelConflictPopup() { cy.Get(entityLabelConflictPopupSelector).should('have.length', 2) }
export function VerifyNoEntityLabelConflictPopup() { cy.Get(entityLabelConflictPopupSelector).should('have.length', 0) }

// textEntityPairs is an array of objects contains these two variables:
//  text = a word within the utterance that should already be labeled
//  entity = name of entity to label the word with
export function VerifyEntityLabelConflictPopupAndClose(previousTextEntityPairs, attemptedTextEntityPairs) { _VerifyEntityLabelConflictPopupAndClickButton(previousTextEntityPairs, attemptedTextEntityPairs, '[data-testid="entity-conflict-cancel"]') }
export function VerifyEntityLabelConflictPopupAndChangeToPevious(previousTextEntityPairs, attemptedTextEntityPairs) { _VerifyEntityLabelConflictPopupAndClickButton(previousTextEntityPairs, attemptedTextEntityPairs, '[data-testid="entity-conflict-accept"]') }
export function VerifyEntityLabelConflictPopupAndChangeToAttempted(previousTextEntityPairs, attemptedTextEntityPairs) { _VerifyEntityLabelConflictPopupAndClickButton(previousTextEntityPairs, attemptedTextEntityPairs, '[data-testid="entity-conflict-accept"]', true) }

function _VerifyEntityLabelConflictPopupAndClickButton(previousTextEntityPairs, attemptedTextEntityPairs, buttonSelector, selectAttempted = false) {
  function VerifyTextEntityPairs(selector, textEntityPairs) {
    const elements = Cypress.$(selector).siblings('[data-testid="extractor-response-editor-entity-labeler"]')
    textEntityPairs.forEach(textEntityPair => VerifyTextIsLabeledAsEntity(textEntityPair.text, textEntityPair.entity, elements))
  }

  helpers.ConLog('VerifyEntityLabelConflictPopupAndClickButton', 'start')

  cy.WaitForStableDOM().then(() => {
    if (previousTextEntityPairs) {
      VerifyTextEntityPairs('[data-testid="extract-conflict-modal-previously-submitted-labels"]', previousTextEntityPairs)
    }

    if (attemptedTextEntityPairs) {
      VerifyTextEntityPairs('[data-testid="extract-conflict-modal-conflicting-labels"]', attemptedTextEntityPairs)
    }

    if (selectAttempted) {
      cy.get('[data-testid="extract-conflict-modal-conflicting-labels"]').click()
    }
    cy.get(buttonSelector).Click()
    helpers.ConLog('VerifyEntityLabelConflictPopupAndClickButton', 'end')
  })
}

export function VerifyEntityDetectionPhrase(expectedPhrase) {
  function CompletePhraseFromEntityDetectionUiElements() {
    let funcName = `StringFromEntityDetectionUiElements('span[data-offset-key]')`
    let elements = Cypress.$('div[class="entity-labeler__editor"]').find('span[data-offset-key]')
    helpers.ConLog(funcName, `Number of Elements Found: ${elements.length}`)
    let textContent = ''
    for (let i = 0; i < elements.length; i++) {
      textContent += elements[i].textContent
    }

    let returnString = textContent.replace(/([^◾️…\x20-\x7E])/gm, '')
    helpers.ConLog(funcName, `Acumulated textContent: "${textContent}" -- normalized textContent: "${returnString}"`)
    return returnString
  }

  cy.WaitForStableDOM().then(() => {
    const detectionPhrase = CompletePhraseFromEntityDetectionUiElements()

    if (detectionPhrase != expectedPhrase) {
      throw new Error(`Bugs 2389 & 2400 - Entity Detection panel shows a phrase that is different than the user's utterance. Detection Phrase: "${detectionPhrase}" --- Expected Phrase: "${expectedPhrase}"`)
    }
  })
}

// Due to: Bug 2396: Entity Labeling is automatically and correctly happening without being trained
// This function is intended to automatically verify that there are no words/phrases labeled as entities
// that we are not expecting. At one point LUIS was automatically and randomly labeling entities, but the
// affect of it was not noticed until some later point in the test where it would result in some random
// failure, and even in some rare cases went unnoticed.
//
// This was not intended to verify that the words/phrases we are expecting to be labeled are actually
// labeled. There are other functions that do that. So to keep the complexity down we are not doing
// that here.
//
// Also the current implementation supports passing in text/Entity pairs that might not be labeled
// for those cases where sometimes LUIS labels a word or phrase and sometimes does not.
export function VerifyEntityDetectionLabeling(expectedTextEntityPairs = undefined) {
  if (expectedTextEntityPairs != undefined && !Array.isArray(expectedTextEntityPairs)) {
    throw new Error(`VerifyEntityDetectionLabeling expects an Array or undefined`)
  }

  function ListOfDetectedEntitiesAndLabeledText() {
    const entityElements = Cypress.$('[data-testid="custom-entity-name-button"]')
    let labeledText = []
    for (let i = 0; i < entityElements.length; i++) {
      const entity = entityElements[i].textContent
      const textElement = Cypress.$(entityElements[i])
        .parents('.cl-entity-node--custom')
        .find('[data-testid="token-node-entity-value"]')

      // If the text that was labeled was multiple words, then there will be multiple entityElements.
      // Piece them all together with a space between words. NOTE: This may fail if other punctuation
      // is involved. Best to keep it simple and not use it, but if necessary then fix this code.
      let text = ''
      for (let ii = 0; ii < textElement.length; ii++) {
        text += textElement[ii].textContent + ' '
      }
      text = text.trim()
      labeledText.push({ text: text, entity: entity })
    }
    return labeledText
  }

  cy.WaitForStableDOM().then(() => {
    const labeledText = ListOfDetectedEntitiesAndLabeledText()

    let errors = ''
    labeledText.forEach(labeled => {
      const found = expectedTextEntityPairs != undefined && expectedTextEntityPairs.find(pair => pair.text == labeled.text && pair.entity == labeled.entity) != undefined
      helpers.ConLog('VerifyEntityDetectionLabeling', `'${labeled.text}' labeled as Entity '${labeled.entity}' was ${found ? 'expected' : 'NOT EXPECTED'}`)
      if (!found) {
        errors += `'${labeled.text}' as '${labeled.entity}' - `
      }
    })
    if (errors.length > 0) {
      throw new Error(`Unexpected words/phrases labled as entities: ${errors}`)
    }
  })
}