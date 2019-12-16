# ConversationLearner

[![CircleCI](https://circleci.com/gh/microsoft/conversationlearner.svg?style=svg)](https://circleci.com/gh/microsoft/conversationlearner)\

This repo contains 5 major components:
1. **Samples** - Fully working bots using express, botbuilder, and the ConversationLearner SDK which demonstrate different use cases in code.
1. **SDK** - Conversation Learner Software Development Kit. This acts as entry point and is intended to be included in your own bots.
1. **Administration UI** - Provides graphical interface to manage, train, and test your bot.
1. **WebChat** - Custom fork of standard [WebChat](https://github.com/Microsoft/BotFramework-WebChat) which adds ability to load existing activities and show editing controls.
1. **Models** - Contains shared code between the SDK and UI such as types and utilities.

# Getting started

1. Clone and build the repo
```bash
git clone https://github.com/Microsoft/ConversationLearner cl
cd cl
npm i
npx lerna bootstrap
npx lerna run build
```

2. Start the bot

Create new .env file in the samples directory with your LUIS keys.

```bash
cd ./packages/samples
cp .env.example .env
<Add LUIS_AUTHORING_KEY and save>
npm start
```

You should see output similar to below (PORT may be different):

```bash
Adding /sdk routes
Adding /ui routes
Adding /directline routes
Server listening at: http://localhost:3978
```

Note the /ui /sdk and /directline routes are printed because we're running in development. These routes are not mounted in production.

3. Run the UI

(Might need new terminal)

```
cd ./packages/ui
npm start
```

# More Details about the SDK (Software Development Kit) package

The SDK includes contains 2 notable components:
1. [Express](https://expressjs.com/en/guide/routing.html) Router - The router is mounted to your server in development and used by the UI (above) during training
2. Recognizer - Similar to other [BotBuilder](https://github.com/Microsoft/botbuilder-js) recognizers like [LUIS](https://github.com/Microsoft/botbuilder-js/blob/master/samples/luis-bot-es6/app.js#L64) the CL recognizer processes the given Bot context and returns results such as messages, adaptive cards, and more.

# Using the SDK

Install @conversationlearner/sdk in consuming project:

```bash
npm install @conversationlearner/sdk --save-exact
```

> Note: We recommend using --save-exact to lock the version since we are NOT following SemVer at this time. This can help prevent accidental package updates which may contain breaking changes if you are not using package-lock.json. We will move to following SemVer soon as we improve our release process.

Using the recognizer:

```typescript
import { ConversationLearner, ICLOptions, ClientMemoryManager } from '@conversationlearner/sdk'

...

const sdkRouter = ConversationLearner.Init({
    CONVERSATION_LEARNER_SERVICE_URI: process.env.CONVERSATION_LEARNER_SERVICE_URI
})
if (isDevelopment) {
    server.use('/sdk', sdkRouter)
}

...

const cl = new ConversationLearner(modelId);

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {
        const result = await cl.recognize(context)
        
        if (result) {
            cl.SendResult(result);
        }
    })
})
```

## Using the UI router.
Previously the UI was served separately and required to be run on a different port than your bot.  Now the UI is included with your bot! The ui is availble at the `/ui` path of your bot url. The leaves the root `/` available for you to add a Bot landing page. There you can summarize your bot's purpose and capabilities to the user.

```typescript
...
import { uiRouter } from '@conversationlearner/sdk'

...

"Mount the router at the root `/` as it internally has the /ui paths."
server.use(uiRouter)

...

server.listen(port)
```
