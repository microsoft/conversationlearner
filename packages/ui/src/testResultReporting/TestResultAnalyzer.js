// USAGE NOTES:
//
// 1) Go to https://circleci.com/account/api
//
// 2) Create a new token, copy to the clipboard, and paste into an ".env" file in the root folder on a new line like this...
//      circle-token=[paste-token-string-here]
//    NOTE: This is a private .env file that must NOT be saved to the repo because this is a secret token.
//
// 3) Run the tool from the "packages\ui" folder like this...
//      ViewTestResults [build-number]
//    You will find the build number on the page https://circleci.com/gh/microsoft/conversationlearner.
//    Be sure to select the build number that coresponds to either a "test-smoke" or "test-regression" run.
//
//    The expected result from using this tool is you will get a lot logging spew in the command window
//    as the tool makes progress processing the test results artifacts. Once it completes, it will open
//    the resulting report in your default browser window. (The logging spew is intended to help debug this tool.)
//
// 4) More details about the API set used here: https://circleci.com/docs/api
//
// The data used to triage each test failure is found in this file "TriageData.js", it contains plenty
// of examples that you can follow to expand it as necessary.

const ttf = require('./TriageTestFailure')
const apiData = require('./ApiData')
const fs = require('fs')
const child_process = require('child_process')

const triageData = require('./TriageData').triageData
ttf.SetTriageData(triageData);

(async function () {

  let buildNumber
  let logs = []
  let mp4s = []
  let pngs = []
  let unknownTestFailures = []
  let knownTestFailures = []
  let passingTests = []
  let errors = []
  let htmlContent = ''

  let iStart
  let iEnd
  let iSpec
  let testName
  let key

  buildNumber = process.argv[2]

  const circleCiToken = GetCircleCiToken()

  const artifacts = await apiData.Get(`https://circleci.com/api/v1.1/project/github/microsoft/conversationLearner/${buildNumber}/artifacts?circle-token=${circleCiToken}`)
  MoveArtifactJsonIntoArrays()
  console.log('Processing the Failed Test Results ----------------------------------')
  await ProcessFailingTestArtifacts()
  console.log('Processing the Passed Test Results ----------------------------------')
  ProcessPassingTestArtifacts()

  console.log('Rendering all Results to HTML ----------------------------------')
  RenderResults()

  const outputPath = `${process.env.TEMP}\\TestResults.${buildNumber}.html`
  console.log(`Writing HTML to File ${outputPath} ----------------------------------`)
  fs.writeFileSync(outputPath, htmlContent)

  child_process.exec(outputPath)

  // --- End of Main process - worker functions below -----------------

  function GetCircleCiToken() {
    const envFileContents = fs.readFileSync('../../.env', { encoding: 'utf8' })
    const CIRCLECI_TOKEN = 'circle-token='
    const iStart = envFileContents.indexOf(CIRCLECI_TOKEN)
    //console.log(typeof envFileContents, '\n', envFileContents)
    if (iStart == -1) {
      throw new Error('circle-token= is missing from the .env file')
    }
    let iEnd = envFileContents.indexOf('\n', iStart + CIRCLECI_TOKEN.length)
    if (iEnd == -1) {
      iEnd = envFileContents.length
    }
    const returnValue = envFileContents.substring(iStart + CIRCLECI_TOKEN.length, iEnd).trim()
    //console.log(returnValue)
    return returnValue
  }

  function MoveArtifactJsonIntoArrays() {
    artifacts.forEach(artifact => {
      const suffix = artifact.url.substring(artifact.url.length - 3)
      switch (suffix) {
        case 'log':
          iStart = artifact.url.indexOf('/cypress/') + '/cypress/'.length
          iEnd = artifact.url.length - '.19.12.05.02.42.14..456.log'.length
          key = artifact.url.substring(iStart, iEnd)
          console.log('key:', key)
          console.log('url:', artifact.url)
          logs.push({ key: key, url: artifact.url })
          break

        case 'mp4':
          iStart = artifact.url.indexOf('/videos/') + '/videos/'.length
          iEnd = artifact.url.length - 4
          testName = artifact.url.substring(iStart, iEnd)
          key = testName.replace(/\/|\\/g, '-')
          console.log('testName:', testName)
          console.log('key:', key)
          console.log('url:', artifact.url)
          mp4s.push({ testName: testName, key: key, url: artifact.url })
          break

        case 'png':
          iStart = artifact.url.indexOf('/screenshots/') + '/screenshots/'.length
          iSpec = artifact.url.indexOf('.spec.', iStart)
          iEnd = artifact.url.indexOf('/', iSpec)
          testName = artifact.url.substring(iStart, iEnd)
          key = testName.replace(/\/|\\/g, '-')
          console.log('testName:', testName)
          console.log('key:', key)
          console.log('url:', artifact.url)
          pngs.push({ testName: testName, key: key, url: artifact.url })
          break

        default:
          console.log('!!!*** What file is this? ***!!!', artifact.url)
          break
      }
    })
  }

  async function ProcessFailingTestArtifacts() {
    for (let i = 0; i < pngs.length; i++) {
      const png = pngs[i]
      let error
      let failureDetails

      //if (png.testName.endsWith('.ts')) continue

      console.log(`*** PNG: ${png.testName} *****************************`)

      const log = logs.find(log => log.key === png.key)
      if (!log) {
        console.log(`ProcessFailingTestArtifacts - going to return since log is undefined`)
        errors.push({ testName: png.testName, key: png.key, url: 'page error: Log file not found' })
        continue
      }

      console.log(`ProcessFailingTestArtifacts - going to await GetTriageDetailsAboutTestFailure`)
      failureDetails = await ttf.GetTriageDetailsAboutTestFailure(log)
      console.log(`ProcessFailingTestArtifacts got failureDetails: { message: ${failureDetails.message}, bugs: ${failureDetails.bugs}, comment: ${failureDetails.comment} }`)

      const mp4 = mp4s.find(mp4 => mp4.key === png.key)
      if (!mp4) {
        console.log('ProcessFailingTestArtifacts - ERROR: Did not find matching mp4')
        errors.push({ testName: png.testName, key: png.key, url: 'page error: mp4 file not found' })
        continue
      }

      let testFailure = {
        testName: png.testName,
        key: png.key,
        snapshotUrl: png.url,
        videoUrl: mp4.url,
        logUrl: log.url,
        knownIssue: failureDetails.knownIssue,
        failureMessage: failureDetails.message,
        bugs: failureDetails.bugs,
        comment: failureDetails.comment,
        errorPanelText: failureDetails.errorPanelText,
      }

      if (testFailure.knownIssue) {
        knownTestFailures.push(testFailure)
      } else {
        unknownTestFailures.push(testFailure)
      }
    }
  }

  function ProcessPassingTestArtifacts() {
    logs.forEach(log => {
      if (unknownTestFailures.findIndex(failure => failure.key === log.key) >= 0) return
      if (knownTestFailures.findIndex(failure => failure.key === log.key) >= 0) return

      const mp4 = mp4s.find(mp4 => mp4.key === log.key)
      if (!mp4) {
        errors.push({ testName: log.key, key: log.key, url: 'page error: mp4 file not found' })
        return
      }

      passingTests.push({
        testName: mp4.testName,
        videoUrl: mp4.url,
        logUrl: log.url,
      })
    })
  }

  function ReplaceSpecialHtmlCharacters(text) {
    return text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;")
  }

  function RenderResults() {
    htmlContent = `
      <html>
      <head>
        <style>
        .grid-container1 {
          display: grid;
          grid-template-columns: auto;
          background-color: #2196F3;
          padding: 5px;
        }
    
        .grid-container2 {
          display: grid;
          grid-template-columns: auto auto;
          background-color: #2196F3;
          padding: 5px;
        }
    
        .grid-item {
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.8);
          padding: 5px;
          font-size: 15px;
          text-align: left;
        }
        </style>
      </head>
    
      <body>
        <h1>Test Results for Build Number <a href='https://circleci.com/gh/microsoft/ConversationLearner-UI/${buildNumber}#artifacts/containers/0' target='_blank'>${buildNumber}</a></h1>
        Triage Data contains signatures for ${triageData.length} known issues.
        <div>
    `
    RenderUnknownFailures()
    htmlContent += `</div>
        <div>
    `
    RenderKnownFailures()
    htmlContent += `</div>
        <div>
    `

    RenderPassingTests()
    htmlContent += `</div>
  </body>
</html>`
  }

  function RenderUnknownFailures() {
    console.log(`${unknownTestFailures.length} UNKNOWN TEST FAILURES -------------------------------------------------------`)

    if (!unknownTestFailures || unknownTestFailures.length == 0) {
      htmlContent += `<h2>No Unknown Failures</h2>`
    } else {
      htmlContent += `
        <h2>${unknownTestFailures.length} Failures with an Unknown Cause</h2>
        <div class="grid-container2">
      `
      unknownTestFailures.forEach(unknownTestFailure => {
        htmlContent += `
          <div class="grid-item">
            <b>${unknownTestFailure.testName}</b><br>
            <a href='${unknownTestFailure.snapshotUrl}' target='_blank'>
              Snapshot
            </a> -- 
            <a href='${unknownTestFailure.videoUrl}' target='_blank'>Video</a>
          </div>

          <div class="grid-item">
        `

        if (unknownTestFailure.errorPanelText) {
          htmlContent += `<b>UI Error Panel:</b> ${unknownTestFailure.errorPanelText}<br>`
        }

        htmlContent += `
            <b>Failure Message:</b> ${ReplaceSpecialHtmlCharacters(unknownTestFailure.failureMessage)}<br>
            <a href='${unknownTestFailure.logUrl}' target='_blank'>
              Log File
            </a><br>
          </div>
        `
      })
      htmlContent + '</div>'
    }
  }

  function RenderKnownFailures() {
    console.log(`${knownTestFailures.length} KNOWN TEST FAILURES ---------------------------------------------------------`)

    if (!knownTestFailures || knownTestFailures.length == 0) {
      htmlContent += `<h2>No Known Failures</h2>`
    } else {
      htmlContent += `
        <h2>${knownTestFailures.length} Failures with a Known Cause</h2>
        <div class="grid-container2">
      `
      knownTestFailures.forEach(knownTestFailure => {
        htmlContent += `
          <div class="grid-item">
            <b>${knownTestFailure.testName}</b><br>
            <a href='${knownTestFailure.snapshotUrl}' target='_blank'>
              Snapshot
            </a> -- 
            <a href='${knownTestFailure.videoUrl}' target='_blank'>Video</a>
          </div>

          <div class="grid-item">
        `
        if (knownTestFailure.comment) {
          htmlContent += `<b>${knownTestFailure.comment}</b><br>`
        }

        if (knownTestFailure.errorPanelText) {
          htmlContent += `<b>UI Error Panel:</b> ${knownTestFailure.errorPanelText}<br>`
        }

        htmlContent += `
            <b>Failure Message:</b> ${ReplaceSpecialHtmlCharacters(knownTestFailure.failureMessage)}<br>
            <a href='${knownTestFailure.logUrl}' target='_blank'>
              Log File
            </a><br>
        `
        // bugs string will look like this: '2136: API Errors not behaving like other errors'
        if (knownTestFailure.bugs) {
          knownTestFailure.bugs.forEach(bug => {
            const i = bug.indexOf(':')
            if (i == -1) {
              htmlContent += `<b>ERROR in TriageData.js "bug" not formatted correctly, the value is: '${bug}'`
            } else {
              const bugNumber = +bug.substring(0, i)
              htmlContent += `
                <a href='https://dialearn.visualstudio.com/BLIS/_workitems/edit/${bugNumber}' target='_blank'>Bug ${bug}</a><br>
              `
            }
          })
        }
        htmlContent += `</div>`
      })
      htmlContent += '</div>'
    }
  }

  function RenderPassingTests() {
    console.log(`${passingTests.length} PASSING TESTS ---------------------------------------------------------------`)

    if (!passingTests || passingTests.length == 0) {
      htmlContent += `<h2>No Passing Tests</h2>`
    } else {
      htmlContent += `
        <h2>${passingTests.length} Passing Tests</h2>
        <div class="grid-container1">
      `
      passingTests.forEach(passingTest => {
        htmlContent += `
          <div class="grid-item">
            <b>${passingTest.testName}</b><br>
            <a href='${passingTest.videoUrl}' target='_blank'>
              Video
            </a> -- 
            <a href='${passingTest.logUrl}' target='_blank'>
              Log File
            </a><br>
          </div>
        `
      })
      htmlContent += `</div>`
    }
  }
}())
