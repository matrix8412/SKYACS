/* @refresh reload */
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { APP_NAME } from './lib/appName'

document.title = APP_NAME

const root = document.getElementById('root')

render(() => <App />, root!)
