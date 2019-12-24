/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as modelPage from '../support/components/ModelPage'
import * as entitiesGrid from './components/EntitiesGrid'
import * as entityModal from '../support/components/EntityModal'
import * as actionsGrid from './components/ActionsGrid'

export const pretrainedEntityTypes = [
  "datetimeV2",
  "number",
  "ordinal",
  "percentage",
  "temperature",
  "dimension",
  "money",
  "age",
  "url",
  "email",
  "phonenumber",
  "geographyV2",
  "personName",
  "keyPhrase",
]

export function CreateNewEntity({
  name,
  multiValued,
  negatable,
  resolverType,
  type = 'Custom Trained',
  expectPopup,
  enumValues,
}) {

  if (type != 'Custom Trained') SelectEntityType(type)
  if (name) { entityModal.TypeEntityName(name) }
  if (multiValued) { entityModal.ClickMultiValueCheckbox() }
  if (negatable) { entityModal.ClickNegatableCheckbox() }
  if (resolverType) { entityModal.SelectResolverType(resolverType) }
  if (enumValues) { entityModal.TypeEnumValues(enumValues) }

  entityModal.ClickCreateButton()
  if (expectPopup) { entityModal.ClickOkButtonOnNoteAboutPreTrained() }
}

export function CreateNewEntityThenVerifyInGrid({
  name,
  multiValued,
  negatable,
  resolverType,
  type = 'Custom Trained',
  expectPopup
}) {

  modelPage.NavigateToEntities()
  entitiesGrid.ClickButtonNewEntity()

  CreateNewEntity(arguments[0])

  let entitiesGridRow
  if (name) { entitiesGridRow = new entitiesGrid.Row(name) }
  else { entitiesGridRow = new entitiesGrid.Row(`builtin-${type.toLowerCase()}`) }

  let typeForVerification = type
  if (type == 'Custom Trained') { typeForVerification = 'CUSTOM' }
  else if (type == 'Programmatic') { typeForVerification = 'PROGRAMMATIC' }
  entitiesGridRow.VerifyType(typeForVerification)

  entitiesGridRow.VerifyResolverType(resolverType)
  entitiesGridRow.VerifyMultiValue(multiValued)
  entitiesGridRow.VerifyNegatable(negatable)
}

export function SelectEntityType(type) {
  entityModal.ClickEntityTypeDropdown()
  entityModal.ClickEntityType(type)
}
