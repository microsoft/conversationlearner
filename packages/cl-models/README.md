# ConversationLearner-Models

Models for ConversationLearner

[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Travis](https://api.travis-ci.com/Microsoft/ConversationLearner-Models.svg?token=x6vFsyYxGQbhsxY6ztLP&branch=master)](https://travis-ci.com/Microsoft/ConversationLearner-Models)
[![CircleCI](https://circleci.com/gh/Microsoft/ConversationLearner-Models.svg?style=shield)](https://circleci.com/gh/Microsoft/ConversationLearner-Models)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/github/Microsoft/ConversationLearner-Models?branch=master&svg=true)](https://ci.appveyor.com/project/conversationlearner/conversationlearner-models)

### Usage

This library is a collection of types, interfaces, and utilities shared across other ConversationLearner repositories:

```bash
git clone https://github.com/Microsoft/conversationlearner-models.git conversationlearner-models
cd conversationlearner-models
npm install
npm run build
npm test
```

### Importing library

```typescript
import * as models from 'conversationlearner-models'
```

### NPM scripts

 - `npm t`: Run test suite
 - `npm start`: Run `npm run build` in watch mode
 - `npm run test:watch`: Run test suite in [interactive watch mode](http://facebook.github.io/jest/docs/cli.html#watch)
 - `npm run test:prod`: Run linting and generate coverage
 - `npm run build`: Generate bundles and typings, create docs
 - `npm run lint`: Lints code
 - `npm run commit`: Commit using conventional commit style ([husky](https://github.com/typicode/husky) will tell you to use it if you haven't :wink:)

### Semantic Release

Semantic release works by analyzing all commits that have occurred since the last release, computing the next version to increment based on the most significant commit found, then tagging and publishing a new package with that version.

See: https://semantic-release.gitbooks.io/semantic-release/content/#how-does-it-work

In order to analyze the commit messages reliably they must be in a known format.  To help writing these commits there is a tool at `npm run commit` which acts a wizard walking you through the options.

Video Demo: https://youtu.be/qf7c-KxBBZc?t=37s