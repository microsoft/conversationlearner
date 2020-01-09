/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

export function VerifyExistingEntityValues(entityName, entityValues) { _VerifyEntitiesInMemory(entityName, '', entityValues, '') }
export function VerifyNewEntityNameAndValues(entityName, entityValues) { _VerifyEntitiesInMemory(entityName, '.cl-font--emphasis', entityValues, '.cl-font--emphasis') }
export function VerifyNewEntityValues(entityName, entityValues) { _VerifyEntitiesInMemory(entityName, '', entityValues, '.cl-font--emphasis') }
export function VerifyDeletedEntityValues(entityName, entityValues) { _VerifyEntitiesInMemory(entityName, '', entityValues, '.cl-font--deleted') }
export function VerifyDeletedEntityNameAndValues(entityName, entityValues) { _VerifyEntitiesInMemory(entityName, '.cl-font--deleted', entityValues, '.cl-font--deleted') }

function _VerifyEntitiesInMemory(entityName, entityNameFont, entityValues, entityValueFont) {
  // We do not want to verify there are not extra values in memory that we are not expecting because some values
  // may have a Strikeout font while others do not so we need to be able to call this function twice; once for the
  // ones with Strikeout font and once for the ones that don't.
  cy.Get(`${entityNameFont}[data-testid="entity-memory-name"]`)
    .ExactMatch(entityName)
    .parents('div.ms-DetailsRow-fields')
    .find(`${entityValueFont}[data-testid="entity-memory-value"]`).then(elements => {
      entityValues.forEach(entityValue => {
        cy.wrap(elements).contains(entityValue)
      })
    })
}

// export function VerifyNoDisplacedEntityInMemory(displacedValue) {
//   cy.DoesNotContain('.cl-font--deleted,[data-testid="entity-memory-value"]', displacedValue)
// }

