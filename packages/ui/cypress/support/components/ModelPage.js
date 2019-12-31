/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
*/

import * as homePage from '../../support/components/HomePage'
import * as entitiesGrid from '../../support/components/EntitiesGrid'
import * as actionsGrid from '../../support/components/ActionsGrid'
import * as trainDialogsGrid from './TrainDialogsGrid'
import * as logDialogsGrid from '../../support/components/LogDialogsGrid'
import * as settings from '../../support/components/Settings'
import * as helpers from '../Helpers'

export function VerifyModelName(name) { cy.Get('[data-testid="app-index-model-name"]').contains(name) }
export function VerifyPageTitle() { cy.Get('[data-testid="dashboard-title"]').contains('Overview').should('be.visible') }
export function IsOverlaid() { return Cypress.$('div.ms-Modal > div.ms-Overlay').length > 0 }

export function NavigateToHome() { cy.Get('[data-testid="app-index-nav-link-home"]').Click(); VerifyPageTitle() }
export function NavigateToEntities() { cy.Get('[data-testid="app-index-nav-link-entities"]').Click(); entitiesGrid.VerifyPageTitle() }
export function NavigateToActions() { cy.Get('[data-testid="app-index-nav-link-actions"]').Click(); actionsGrid.VerifyPageTitle() }
export function NavigateToTrainDialogs() { cy.Get('[data-testid="app-index-nav-link-train-dialogs"]').Click(); trainDialogsGrid.VerifyPageTitle() }
export function NavigateToLogDialogs() { cy.Get('[data-testid="app-index-nav-link-log-dialogs"]').Click(); logDialogsGrid.VerifyPageTitle() }
export function NavigateToSettings() { cy.Get('[data-testid="app-index-nav-link-settings"]').Click(); settings.VerifyPageTitle() }
export function NavigateToMyModels() { cy.Get('[data-testid="app-index-nav-link-my-models"]').Click(); homePage.VerifyPageTitle() }

export function VerifyHomeLinkShowsIncidentTriangle() { cy.Get('[data-testid="app-index-nav-link-home"]').find('i[data-icon-name="IncidentTriangle"]') }
export function VerifyHomeLinkDoesNotShowIncidentTriangle() { cy.Get('[data-testid="app-index-nav-link-home"]').DoesNotContain('i[data-icon-name="IncidentTriangle"]') }

// Verify for just the Left Pane "Train Dialogs" link.
export function VerifyNoErrorTriangleOnPage() { VerifyIncidentIcon(false, 'cl-color-error') }
export function VerifyErrorTriangleForTrainDialogs() { VerifyIncidentIcon(true, 'cl-color-error') }
export function VerifyNoWarningTriangleOnPage() { VerifyIncidentIcon(false, 'cl-color-warning') }
export function VerifyWarningTriangleForTrainDialogs() { VerifyIncidentIcon(true, 'cl-color-warning') }

function VerifyIncidentIcon(errorIconExpected, colorClassSelector) {
  let funcName = `VerifyErrorIcon(${errorIconExpected})`

  cy.WaitForStableDOM()
  let retryInfo = { countFound: -1, timesInARowAtThisCount: 0 }
  cy.Timeout(10000).RetryLoop(() => {
    const elements = Cypress.$(`i[data-icon-name="IncidentTriangle"].${colorClassSelector}`)
    if (elements.length === retryInfo.countFound) { retryInfo.timesInARowAtThisCount++ }
    else {
      // The count changed since the last time we looked at this.
      retryInfo.countFound = elements.length
      retryInfo.timesInARowAtThisCount = 0
    }

    helpers.ConLog(funcName, `Number of Incident Triangles found on page: ${retryInfo.countFound} - Number of times in a row it was found: ${retryInfo.timesInARowAtThisCount}`)
    if (retryInfo.timesInARowAtThisCount < 15) {
      throw new Error(`${retryInfo.timesInARowAtThisCount} times in a row we have seen ${retryInfo.countFound} incident triangles on the page, need to see it there 15 times before we can trust it won't change again.`)
    }

    // At this point we know that we have seen the same number of incident triangles many times in a row.
    // Now we need to verify that it is in the state we expect, and if this next part fails, it will retry
    // up to the time out setting to see if it changes to what we expect.

    if (!errorIconExpected) {
      if (elements.length > 0) {
        throw new Error(`Expected to find no Incident Triangles on the page, yet ${elements.length} were found`)
      }
    } else {
      const parents = Cypress.$(elements).parents('[data-testid="app-index-nav-link-train-dialogs"]')
      helpers.ConLog(funcName, `Found ${parents.length} parents`)
      if (parents.length !== 1) {
        throw new Error('Expected to find an Incident Triangle for Train Dialogs, but did not.')
      }
    }
  })
}