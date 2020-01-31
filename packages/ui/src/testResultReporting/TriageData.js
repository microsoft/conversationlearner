const FAILURE_MESSAGE = 'fm'
const ERROR_PANEL = 'ep'
const FULL_LOG = 'fl'

// NOTE: A complex example of how this data structure can be used can be found at the end of this file.

exports.triageData = [
  {
    searchBy: ERROR_PANEL,
    and: [`LUIS Programmatic APIs v2.0 have exceeded rate limit of your current LUIS API`],
    comment: `We can probably solve this problem by using our team's Azure account to acquire LUIS licenses.`,
  },
  {
    searchBy: ERROR_PANEL,
    and: [`Creating Application Failed Request failed with status code 400 "Bad Request {"Locale":["The Locale field is required."]}`],
    bugs: ['2408: Creating Application Failed error happens attempting to create a model.'],
  },
  {
    searchBy: ERROR_PANEL,
    and: [`502 "Bad Gateway "`],
    comment: 'Network or Service Issues - It should eventually fix itself.',
  },
  {
    or: [
      `Status is queued - Still Waiting for Status == Running or Completed - Queued Wait Time:`,
      `Stauts is queued - Still Waiting for Status == Running or Completed - Queued Wait Time:`,
    ],
    bugs: ['2415: Common Test Failure: Waiting for Training Status to transition from Queued to Running takes more than 5 minutes']
  },
  {
    and: [`Timed out retrying: Expected to find element: 'button.ms-Dropdown-item[title="Enum"]', but never found it.`],
    bugs: [`2409: TEST: fails to create an entity in test 'Bug 2259 Repro'`],
    comment: 'Fails to create an entity - only on CircleCI',
  },
  {
    and: [`Bugs 2389 & 2400 - Entity Detection panel shows a phrase that is different than the user's utterance.`],
    bugs: [
      `2389: Entity Detection stutters as it repeats the user's utterance many times`,
      `2400: Use of APIs cause User Turns to be mangled in the Entity Detection panel`,
    ]
  },
  {
    or: [`Expected to find content: 'world peace' within the element: [ <span.`],
    bugs: [`2416: Entity Detection mislabels phrase and labels totally unspecified Entity`],
  },

  {
    testName: 'Regression-Log',
    and: [
      `Timed out retrying: Expected to find content:`,
      `within the element: <div.wc-message-content> but never did.`,
    ],
    bugs: [`2197: ERROR: Extract Entities: Session not found.`]
  },
  {
    and: [
      `cy.visit() failed trying to load:`,
      `http://localhost:3000/`
    ],
    comment: 'This happens from time to time and there is no known fix for it.',
  },
  {
    searchBy: FULL_LOG,
    and: [
      `Failure Message: You attempted to select the phrase:`,
      `, but it was not found in the input:`,
    ],
    bugs: [`2422: Test_SelectWord failed to find a phrase in the user input that was actually there`],
    comment: 'Bug in Test_SelectWord',
  },
  {
    testName: 'Regression-Train-DateTimeResolver.spec.js',
    and: [
      `Found ZERO elements that exactly matches 'You are leaving on`,
      `and returning on`,
    ],
    bugs: [`1816: Need to pass Timezone into LUIS when doing Entity Extraction`],
    comment: 'This bug happens mid afternoon because the server is in one timezone and the UI in another.',
  },
  {
    testName: 'Regression-BugRepro-Bug2319Repro.spec.js',
    and: [`Expected to find 'X' in the text chat pane, instead we found 'ERROR: Missing ConversationReference' at index: 4`],
    bugs: [`2319: Undo causes Score Actions to happen at the wrong time and errors out`],
    comment: 'This bug is NOT 100% reproducible thus this test case is coded to fail when the bug occurs (which is the opposite of the other "bug" tests when the bug has not been fixed).',
  },
  {
    testName: 'Regression-Log-Abandon.spec.js',
    // Using OR since there will probably be other variations on the failure message associated with this bug
    or: [`Timed out retrying: 3 rows found in the training grid, however we were expecting 2`],
    bugs: [`2212: End Session incorrectly placed durring Log Dialog session`],
  },
  {
    testName: 'Regression-BugRepro-Bug2119Repro.spec.js',
    searchBy: FULL_LOG,
    // Using OR since there will probably be other variations on the failure message associated with this bug
    or: [`TextContentWithoutNewlines - Raw Text Content: "User utterance **#**6"`],
    bugs: [`2423: Train Dialog: User input had extra characters added to it.`],
    comment: 'PLEASE UPDATE BUG REPORT with a count on any instances of this bug that you find.',
  },
  {
    testName: 'Regression-EntityLabeling-ConsistentEntityLabeling.spec.js',
    and: [
      `Timed out retrying: cy.click() failed because this element is not visible:`,
      `data-testid="edit-teach-dialog-close-save-button"`
    ],
    bugs: [`2300: Use of "Attempted Labels" option of the "Inconsistent Entity Labels" modal popup fails when the conflict is in the same TD`],
    comment: 'TODO: work out which bug is the real cause and get this test case working again.'
  },
]


exports.closedBugData = [
  // Closed bugs - Eventually these can be removed from the list to speed things up, however we might
  // want to keep the details around in this nutral corner of this data file in case of regressions.
  // CURRENTLY THIS DATA IS NOT USED
  {
    testName: 'Regression-Train-ApiMemoryManipulation.spec.js',
    and: [
      `Expected to find element: '[data-testid="action-scorer-button-clickable"]', but never found it. Queried from element: <div.ms-DetailsRow-fields`,
      {
        searchBy: FULL_LOG,
        and: [`FAILED - Test Case: 'API Memory Manipulation - Train - Train - Should remove one of the toppings and verify the resulting list is correct'`],
      }
    ],
    bugs: [`2416: Entity Detection mislabels phrase and labels totally unspecified Entity`],
    comment: 'Another instance of that LUIS bug that mislabels Entities.',
  },
  {
    and: [
      "Timed out retrying: Expected to find content: 'z-rename-",
      "within the element: <div.css-69> but never did.",
    ],
    bugs: [`2407: TEST: Settings - renamed model not found in model list`],
  },
  {
    testName: 'Settings.spec.js',
    and: [`RETRY - Loaded Model List Row Count does not yet match the aria-rowcount.`],
    bugs: [`2418: TEST: Settings - Copy Model - Loaded Model List Row Count does not yet match the aria-rowcount`],
  },
  {
    and: [`Chat turn 2 should be an exact match to: The user asks a silly question, however, we found The user asks another question instead`],
    comment: 'UI BUG is fixed - Test code modified to pass, should see this working soon.',
    bugs: [`2265: Editing 1st user turn to label entities saves changes to 2nd user turn`]
  },
  {
    or: [
      `Expected to find element: '[data-testid="fuse-match-option"]', but never found it. Queried from element: <div.editor-container.`,
      `Response: What's your name? - Expected to find data-testid="action-scorer-button-clickable" instead we found "action-scorer-button-no-click"`
    ],
    bugs: [`2396: Entity Labeling is automatically and correctly happening without being trained`],
  },
  {
    testName: 'MissingAction.spec.js',
    and: [`Timed out retrying: Expected to find element: '[data-testid="action-scorer-button-clickable"]', but never found it. Queried from element: <div.ms-DetailsRow-fields.`],
    bugs: [`2419: Entity Detection double labels a phrase`],
  },
  {
    testName: 'Bug2379Repro.spec.js',
    and: [`Timed out retrying: Expected to find element: 'span[role="button"]', but never found it. Queried from element: <span.ms-TagItem-text.>`],
    comment: 'TEST BUG - Its been fixed, should see this working soon.',
  },
]


// NOT USED BY THE CODE - AN EXAMPLE ONLY
exampleTriageData = [
  { // This is a COMPLEX EXAMPLE that shows how to search different strings found in the test artifacts.
    // 
    and: [
      `Expected to find element:`,  // must be in the Failure Message
      `but never found it.`,        // and this must also be in the Failure Message
      {                             // and this entire block must result in TRUE
        searchBy: FULL_LOG,         // Search will now occur in the FULL_LOG
        or: [
          `This will NOT be found`, // Since we are now in an OR this one can be FALSE if the other is TRUE
          {                         // Starting a new block that is ORed with the prior test
            and: [
              `Should import a model to test against and navigate to Train Dialogs view`, // this should also be found in the FULL_LOG
              {                       // Starting a new block that is ANDed with the prior test
                searchBy: ERROR_PANEL,// Search will now occur in the ERROR_PANEL
                and: [`Creating Application Failed Request failed with status code 400 "Bad Request {"Locale":["The Locale field is required."]}`],
              },
            ]
          },
        ],
      },
    ],
    comment: 'This is a complex query example',
  },
]