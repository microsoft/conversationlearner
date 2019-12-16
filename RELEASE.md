# Release Process

This document outlines the process a developer would take to release a new version of @mattmazzola/sdk.

## Dependency Tree

In normal applications UI is generally the top level dependency the user interacts with; however, in this case @mattmazzola/ui is an actual npm package of the @mattmazzola/sdk.  This allows the SDK to provide every thing the developer needs to get started.

```
  converstionlearner-samples
      |
  @mattmazzola/sdk
      |    \
      |  @mattmazzola/ui
      |    /  \
      |   /  @mattmazzola/webchat
      |  /
  @mattmazzola/models
```

> Notice @mattmazzola/models is consumed by both the SDK and UI
