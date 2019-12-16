# Release Process

This document outlines the process a developer would take to release a new version of @conversationlearner/sdk.

## Dependency Tree

In normal applications UI is generally the top level dependency the user interacts with; however, in this case @conversationlearner/ui is an actual npm package of the @conversationlearner/sdk.  This allows the SDK to provide every thing the developer needs to get started.

```
  converstionlearner-samples
      |
  @conversationlearner/sdk
      |    \
      |  @conversationlearner/ui
      |    /  \
      |   /  @conversationlearner/webchat
      |  /
  @conversationlearner/models
```

> Notice @conversationlearner/models is consumed by both the SDK and UI
