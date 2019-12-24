/**
* Copyright (c) Microsoft Corporation. All rights reserved.  
* Licensed under the MIT License.
* 
* AUTHOR: Michael Skowronski
*
* This code eliminiates the need for adding cy.wait() commands to your code and also
* cy.route() commands used only for waiting. It does this by constantly monitoring the
* DOM for changes and tracking the Milliseconds Since the Last Change and also resetting
* those Milliseconds to zero when we see the spinner is displayed. Certain cy.commands(),
* such as cy.Get(), are then modified to prevent execution until this Millisecond count
* reaches at least 700.
* 
* The basic premis this works on is that when the application under test is making API
* calls, the spinner is displayed, therefore further test steps should be paused. Also when 
* the spinner is not visible, the Javascript on the page should either be actively updating
* the DOM or should not be running. Experience shows that these updates almost always complete
* within 700 milliseconds since the last change, or another one occures to reset the count.
*/

import * as helpers from './Helpers.js'

(function () {
  let lastMonitorTime = 0
  let lastChangeTime = 0
  let waitTillNChangesOccur = 0
  let lastHtml
  let StopLookingForChanges = false
  let dumpHtml = false

  let expectingSpinner
  let currentSpinnerText = ''

  Initialize()

  function MillisecondsSinceLastChange() {
    if (new Date().getTime() > lastMonitorTime + 50) LookForChange()

    // Some operations are known to take a long time without rendering, so while this count
    // is greater than zero, we will reset our lastChangeTime and return zero which will
    // effectively cause a wait until the specified number of changes pass and then resume
    // our normal monitoring for stable DOM.
    if (waitTillNChangesOccur > 0) {
      lastChangeTime = new Date().getTime()
      return 0
    }

    return (new Date().getTime() - lastChangeTime)
  }

  function Stop() { StopLookingForChanges = true }

  function Initialize() {
    helpers.ConLog(`MonitorDocumentChanges.initialize()`, `Start`)

    // This 'should' command overwrite is a hack around this issue: 
    // https://github.com/cypress-io/cypress/issues/1221
    Cypress.Commands.overwrite('should', (originalFn, subject, chainers, value) => {
      if (value == 'MillisecondsSinceLastChange') {
        //helpers.ConLog(`cy.should())`, `Waiting for Stable DOM - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago - subject: ${subject} - chainers: ${chainers} - value: ${value}`)
        return originalFn(subject, chainers, MillisecondsSinceLastChange())
      }
      return originalFn(subject, chainers, value)
    })

    Cypress.Commands.add('Get', (selector, options) => {
      helpers.ConLog(`cy.Get(${selector})`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      cy.wrap(700, { timeout: 60000 }).should('lte', 'MillisecondsSinceLastChange').then(() => {
        helpers.ConLog(`cy.Get(${selector})`, `DOM Is Stable`)
        cy.get(selector, options)
      })
    })

    Cypress.Commands.add('Contains', (selector, content, options) => {
      helpers.ConLog(`cy.Contains()`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago\nSelector: ${selector} -- Content: ${content}`)
      cy.wrap(700, { timeout: 60000 }).should('lte', 'MillisecondsSinceLastChange').then(() => {
        helpers.ConLog(`cy.Contains()`, `DOM Is Stable`)
        cy.contains(selector, content, options)
      })
    })

    // The last "expectFailure" parameter is used only for testing that this function works.
    // To use it, set up the conditions where the selector (and optional text if appropriate)
    // does exist on the page and call this with "expectFailure" set to true. If this finds
    // the selector then this method will return true, otherwise false.
    // Without setting "expectFailure" this method will throw an exception on failure.
    Cypress.Commands.add('DoesNotContain', { prevSubject: 'optional' }, (subject, selector, textItShouldNotContain, expectFailure = false) => {
      DoesNotContain(subject, selector, textItShouldNotContain, expectFailure, false)
    })

    // The last "expectFailure" parameter is used only for testing that this function works.
    // To use it, set up the conditions where the selector (and optional text if appropriate)
    // does exist on the page and call this with "expectFailure" set to true. If this finds
    // the selector then this method will return true, otherwise false.
    // Without setting "expectFailure" this method will throw an exception on failure.
    Cypress.Commands.add('DoesNotContainExact', { prevSubject: 'optional' }, (subject, selector, textItShouldNotContain, expectFailure = false) => {
      DoesNotContain(subject, selector, textItShouldNotContain, expectFailure, true)
    })

    function DoesNotContain(subject, selector, textItShouldNotContain, expectFailure, exactMatch) {
      const funcName = `cy.DoesNotContain(${subject}, ${selector}, ${textItShouldNotContain}, ${expectFailure})`
      helpers.ConLog(funcName, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      cy.wrap(700, { timeout: 60000 }).should('lte', 'MillisecondsSinceLastChange').then(() => {
        helpers.ConLog(funcName, `DOM Is Stable`)

        let elements
        if (subject) elements = Cypress.$(subject).find(selector)
        else elements = Cypress.$(selector)

        helpers.ConLog(funcName, `Found ${elements.length} for selector: ${selector}`)

        let foundCount = 0
        if ((elements.length > 0)) {
          if (!textItShouldNotContain) { foundCount = elements.length }
          else {
            for (let i = 0; i < elements.length; i++) {
              let elementText = helpers.TextContentWithoutNewlines(elements[i])
              if ((exactMatch && elementText === textItShouldNotContain) || (!exactMatch && elementText.includes(textItShouldNotContain))) {
                helpers.ConLog(funcName, `Found "${textItShouldNotContain}" in this element >>> ${elements[i].outerHTML}`)
                foundCount++;
              }
            }
          }
        }

        if (foundCount > 0) {
          if (expectFailure) return true;
          throw new Error(`selector: "${selector}" & textItShouldNotContain: "${textItShouldNotContain}" was expected to be missing from the DOM, instead we found ${foundCount} instances of it.`)
        }
        helpers.ConLog(funcName, `PASSED - Selector was NOT Found as Expected`)
        if (expectFailure) return false;
      })
    }

    Cypress.Commands.add('WaitForStableDOM', () => {
      helpers.ConLog(`cy.WaitForStableDOM()`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      cy.wrap(700, { timeout: 60000 }).should('lte', 'MillisecondsSinceLastChange')
    })

    Cypress.Commands.add('Click', { prevSubject: true, element: true }, (subject, options) => {
      helpers.ConLog(`cy.Click()`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      lastChangeTime = new Date().getTime()
      cy.wrap(subject).click(options)
        .then(() => {
          helpers.ConLog(`cy.Click()`, `done - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
          lastChangeTime = new Date().getTime()
        })
    })

    // This will force any of our code that waits for stable DOM to wait until 'changeCount' number of changes
    // are detected, and then another 700 milliseconds of no changes (resuming normal operation) before the 
    // DOM is considered stable.
    //
    // The use case for this is when the normal waiting fails because we are expecting a change to the DOM but 
    // it takes too long to occur. This is typically a product bug, but if not, or to temporarily workaround the
    // product bug you can consult the logs and see what changes come and determine the count of those changes
    // that must occur before normal operations are to resume.
    Cypress.Commands.add('WaitTillNChangesOccur', { prevSubject: 'optional' }, (elements, changeCount) => {
      helpers.ConLog(`cy.WaitTillNChangesOccur(${changeCount})`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      waitTillNChangesOccur = changeCount
    })

    Cypress.Commands.add('RunAndExpectDomChange', (func) => {
      helpers.ConLog(`cy.RunAndExpectDomChange()`, `Start - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      lastChangeTime = new Date().getTime()
      func()
      helpers.ConLog(`cy.RunAndExpectDomChange()`, `done - Last DOM change was ${MillisecondsSinceLastChange()} milliseconds ago`)
      lastChangeTime = new Date().getTime()
    })

    Cypress.Commands.add('DumpHtmlOnDomChange', (boolValue) => { dumpHtml = boolValue })

    Cypress.on('window:before:load', () => {
      helpers.ConLog(`window:before:load`, `MillisecondsSinceLastChange: ${MillisecondsSinceLastChange()}`)
      lastChangeTime = new Date().getTime()
    })

    Cypress.on('window:load', () => {
      helpers.ConLog(`window:load(complete)`, `MillisecondsSinceLastChange: ${MillisecondsSinceLastChange()}`)
      lastChangeTime = new Date().getTime()
    })

    Cypress.on('url:changed', (newUrl) => {
      helpers.ConLog(`url:changed`, `New URL ${newUrl} - MillisecondsSinceLastChange: ${MillisecondsSinceLastChange()}`)
      lastChangeTime = new Date().getTime()
    })

    lastChangeTime = new Date().getTime()
    lastHtml = Cypress.$('html')[0].outerHTML
    setTimeout(() => { LookForChange(true) }, 50)   // This will repeat until Stop is called.

    helpers.ConLog(`MonitorDocumentChanges.initialize()`, `Running`)
  }

  let dumpSpinner = false
  function LookForChange(loop) {
    const funcName = `MonitorDocumentChanges.LookForChange(${loop})`

    if (StopLookingForChanges) {
      helpers.ConLog(funcName, `DONE`)
      return
    }

    const currentTime = lastMonitorTime = new Date().getTime()
    const currentHtml = Cypress.$('html')[0].outerHTML
    if (currentHtml != lastHtml) {
      if (waitTillNChangesOccur > 0) { waitTillNChangesOccur-- }
      helpers.ConLog(funcName, `Change Found - Milliseconds since last change: ${(currentTime - lastChangeTime)}`)
      if (dumpHtml) {
        helpers.ConLog(funcName, `Current HTML:\n${currentHtml}`)
      } else {
        // If the error panel is up dump its elements to the log file so that they can be used to help
        // identify a bug using our test result evaluation tool.
        const errorPanelElements = Cypress.$('div.cl-errorpanel')
        if (errorPanelElements.length > 0) {
          helpers.DumpElements(`${funcName} - Error Panel found in Current HTML`, errorPanelElements)
        }
      }

      lastChangeTime = currentTime
      lastHtml = currentHtml
    }

    MonitorSpinner()

    if (loop) setTimeout(() => { LookForChange(true) }, 50)   // Repeat this same function 50ms later
  }

  function MonitorSpinner() {
    const funcName = `MonitorDocumentChanges.MonitorSpinner()`

    const spinnerTexts =
      [
        'data-testid="spinner"',
        '<div class="ms-Spinner-circle ms-Spinner--large circle-50">',
      ]

    for (let i = 0; i < spinnerTexts.length; i++) {
      if (lastHtml.includes(spinnerTexts[i])) {
        // We found a spinner on the page.
        lastChangeTime = new Date().getTime()
        SetExpectingSpinner(false)

        if (spinnerTexts[i] != currentSpinnerText) {
          if (dumpHtml) { helpers.ConLog(funcName, `Start - ${spinnerTexts[i]} - current HTML:\n${lastHtml}`) }
          currentSpinnerText = spinnerTexts[i]
        }
        return
      }
    }

    // Spinner NOT found on the page.
    if (currentSpinnerText != '') {
      helpers.ConLog(funcName, `Stop - ${currentSpinnerText}`)
      currentSpinnerText = ''
    }

    if (expectingSpinner) {
      // Since we are expecting the spinner to show up, we reset the lastChangeTime and in doing so
      // we prevent the test from progressing prematurely.
      helpers.ConLog(funcName, `Expecting Spinner to show up`)
      lastChangeTime = new Date().getTime()
    }
  }

  function SetExpectingSpinner(value) {
    if (expectingSpinner == value) return
    helpers.ConLog(`MonitorDocumentChanges.SetExpectingSpinner()`, `Value Changed from ${expectingSpinner} to ${value}`)
    expectingSpinner = value
  }
}())
