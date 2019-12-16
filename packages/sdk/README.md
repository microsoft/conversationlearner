# ConversationLearner-SDK

Conversation Learner Software Development Kit

This repo is intended to be consumed by your bot. The SDK contains 3 major components:
1. Administration UI - provides graphical interface to manage, train, and test your bot
2. [Express](https://expressjs.com/en/guide/routing.html) Router - The router is mounted to your server in development and used by the UI (above) during training
3. Recognizer - Similar to other [BotBuilder](https://github.com/Microsoft/botbuilder-js) recognizers like [LUIS](https://github.com/Microsoft/botbuilder-js/blob/master/samples/luis-bot-es6/app.js#L64) the CL recognizer processes the given Bot context and returns results such as messages, adaptive cards, and more.

# Getting started

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
server.use(uiRouter as any)

...

server.listen(port)
```
