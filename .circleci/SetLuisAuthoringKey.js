const authoringKeys = [
  process.env.LUIS_AUTHORING_KEY_ALT_1,
  process.env.LUIS_AUTHORING_KEY_ALT_2,
  process.env.LUIS_AUTHORING_KEY_ALT_3,
  process.env.LUIS_AUTHORING_KEY_ALT_4,
  process.env.LUIS_AUTHORING_KEY_ALT_5,
  process.env.LUIS_AUTHORING_KEY_ALT_6,
  process.env.LUIS_AUTHORING_KEY_ALT_7,
  process.env.LUIS_AUTHORING_KEY_ALT_8,
  process.env.LUIS_AUTHORING_KEY_ALT_9,
  process.env.LUIS_AUTHORING_KEY_ALT_10,
  process.env.LUIS_AUTHORING_KEY_ALT_11,
  process.env.LUIS_AUTHORING_KEY_ALT_12,
  process.env.LUIS_AUTHORING_KEY_ALT_13,
  process.env.LUIS_AUTHORING_KEY_ALT_14,
]

let buildNumber = +process.env.CIRCLE_BUILD_NUM

// We have 11 LUIS Authoring Keys that we rotate through.
// We use the Circle CI Build Number to help us get an index to each in sequence.

// Each time a build workflow is kicked off there multiple workflow jobs:
//  1) the actual build
//  2) the smoke test run
//  3) the regression test run
//  ...others like 'deploy' and whatever might be new as of recently

// The two test jobs will each consume the resources of one of our authoring keys.
// The other jobs will NOT consume the resources of one of our authoring keys, but
// that is okay since as we cycle through the list of authoring keys the next time through
// the previously unused keys will get used and different authoring keys will go unused.

let authoringKeyIndex = Math.floor(buildNumber % authoringKeys.length)
let luisAuthoringKey = authoringKeys[authoringKeyIndex]

// Because of the math used in the algorithm above, the number of authoring keys should
// be a prime number, otherwise there is a chance that some keys will get used all the time
// while others are not used. Also there should be enough keys so that at least 4 full runs
// can complete before it begins reusing keys.
//
// There are other things can influence the next build number to be used, like if the
// build fails, then the other two jobs won't run so only 1 build number
// will be consumed, but that is factored into the algorithm.

console.log(`export LUIS_AUTHORING_KEY=${luisAuthoringKey}\n`)

// Expose build number to Cypress for unique model naming
console.log(`export CYPRESS_BUILD_NUM=${buildNumber}\n`)
