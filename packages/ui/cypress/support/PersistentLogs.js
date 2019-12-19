/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */

(function () {
  let test
  let logFileName
  let logEntries = ''
  let failureMessage = ''

  // -----------------------------------------------------------------------------
  // To capture the error message in the event of a test failure.
  // -----------------------------------------------------------------------------

  Cypress.on('fail', (err, runnable) => {
    if (!err || !err.message) {
      throw err
      //return true
    }

    // Use this commented out code to capture certain errors and let them pass
    // for certain scenarios where you are testing the test code and need to 
    // ignore certain errors to make progress with coding a test suite.
    // if (err.message.includes('whatever')) {
    //   return false
    // }

    failureMessage = err.message
    throw err
  })

  // -----------------------------------------------------------------------------
  // Redirecting console.log so that we can persist it to a file.
  // -----------------------------------------------------------------------------

  // Override the original console.log() function
  const originalConsolLog = console.log

  // This becomes the effective console.log() function.
  console.log = function (message) {
    originalConsolLog.apply(console, arguments)
    logEntries += message + '\r\n'
  }

  // Write ONLY to the true console.log and NOT our persistent log.
  // Uncomment to use this for debugging purposes.
  // function consoleLogOnly() { originalConsolLog.apply(console, arguments) }

  // -----------------------------------------------------------------------------
  // Functions that add additional log entries related to the stage of the test 
  // suite and to persist the captured logs at the appropriate time.
  // -----------------------------------------------------------------------------

  // FINAL LOGGING SUPPORT FOR PREVIOUS TEST CASE
  // In an ideal world this code would be in an afterEach call, however, since 
  // there will be other afterEach functions that will be called after ours and 
  // we want to ensure the logging we do here is the final logging for the test 
  // case.
  //
  // Also important to notice is that this results in a call to cy.writeFile
  // which will execute in a different time sequence than all of the other 
  // JavaScript in this code block. Thus in this code block we cannot run any
  // true `beforeEach` code that is related to the current test case that is
  // just about to start.
  // FINAL LOGGING SUPPORT FOR PREVIOUS TEST CASE
  beforeEach(function () {
    LogTestState()
    FlushLogEntries()
  })

  // TRUE `beforeEach` CODE FOR THE TEST CASE THAT IS JUST NOW STARTING
  // This MUST come after the prior `beforeEach` code block and cannot
  // be combined with that other code block due to the `cy.writeFile`
  // call that it contains.
  beforeEach(function () {
    console.log('')
    console.log(`******************** ${GetFullTestSuiteTitle(this.currentTest)} ************************************************************`)

    test = this.currentTest
    if (!logFileName) {
      const specFileId = Cypress.spec.name.replace(/\/|\\/g, "-")
      logFileName = `./results/cypress/${specFileId}.${Cypress.moment().format("YY.MM.DD.HH.mm.ss..SSS")}.log`
    }
  })

  // After each test case ends...
  afterEach(() => { WriteLogEntries() })

  after(() => {
    LogTestState()
    FlushLogEntries()
  })

  // -----------------------------------------------------------------------------
  // Support functions.
  // -----------------------------------------------------------------------------

  function LogTestState() {
    if (!test) { return false }

    const message = `: ${test.state.toUpperCase()} - Test Case: '${GetFullTestSuiteTitle(test)}' - ${test.state.toUpperCase()} :`
    console.log('.'.repeat(message.length))
    console.log(message)
    console.log("'".repeat(message.length))
    if (test.state == 'failed' && failureMessage != '') {
      console.log(`Failure Message: ${failureMessage}`)
      failureMessage = ''
    }
  }

  // NOTE: This requires the latest version (3.1.5) of Cypress:
  //        change directory to the root project folder
  //        npm install cypress --save-dev
  function WriteLogEntries() {
    if (logFileName) {
      // If this fails the likely causes are:
      //  1. You root path to this project is too long.
      //  2. The root test description set in the call to `describe()` is too long.
      //  3. You don't have permision to write to the `./results/cypress/` folder
      cy.writeFile(logFileName, logEntries, { flag: 'a' })
        .then(() => { logEntries = '' })
    }
  }

  function FlushLogEntries() {
    if (logFileName && logEntries.length > 0) {
      // Because of 'afterEach' functions that were called after we wrote our previous
      // log entries, there are additional log entries to persist to that same log file.
      WriteLogEntries()
    }
  }

  function GetSuiteRootTitle(test) {
    if (!test.parent) throw new Error('Did not find test.parent')

    if (test.parent.title === '') { return test.title }
    return GetSuiteRootTitle(test.parent)
  }

  function GetFullTestSuiteTitle(test) {
    if (!test.parent) throw new Error('Did not find test.parent')

    if (test.parent.title === '') { return test.title }
    return `${GetFullTestSuiteTitle(test.parent)} - ${test.title}`
  }
}())