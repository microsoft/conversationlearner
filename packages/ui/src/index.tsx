/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Provider } from 'react-redux'
import { createReduxStore } from './reduxStore'
import App from './routes/App'
import { addLocaleData, IntlProvider } from 'react-intl'
// TODO: It should not be wild card import but TypeScript won't allow the default import
import * as en from 'react-intl/locale-data/en'
import * as ko from 'react-intl/locale-data/ko'
import messages from './react-intl-messages'
import { Fabric, loadTheme } from 'office-ui-fabric-react'
import { initializeIcons } from 'office-ui-fabric-react/lib/Icons'

// Required for Office UI Fabric to load icon fonts  
initializeIcons()
// Override default colors 
loadTheme({
  palette: {
    // 'themePrimary': 'red' 
  }
})

// Initialize react-intl-messages 
addLocaleData([...en, ...ko])

console.log(`process.env.NODE_ENV: `, process.env.NODE_ENV)

const locale = (navigator.languages?.[0])
  ?? navigator.language
  ?? (navigator as any).userLanguage
  ?? 'en-US'

ReactDOM.render(
  <Provider store={createReduxStore()}>
    <IntlProvider locale={locale} messages={messages[locale]}>
      <Fabric>
        <App />
      </Fabric>
    </IntlProvider>
  </Provider>,
  document.getElementById('root') as HTMLElement
)
