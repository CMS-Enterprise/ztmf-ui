/**
 * The entry point for application
 * @module main
 */
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import CONFIG from '@/utils/config'
import router from '@/router/router'
import { SIGN_IN_GREETING } from '@/locales/en'
// Self-hosted typefaces (no third-party CDN, per federal hosting rules).
// Public Sans for UI text, JetBrains Mono for scores, IDs and codes.
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/public-sans/700.css'
import '@fontsource/public-sans/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@/sass/style.scss'
import onPerfEntry from './utils/onPerfEntry'
import { initLogoutListener } from '@/utils/sessionSync'
import { SnackbarProvider } from 'notistack'
// IIFE that initializes the root node and renders the application.
;(async function () {
  // Once per tab lifetime, outside React so StrictMode cannot double-invoke it.
  initLogoutListener()

  // create the root element in the DOM
  const rootElement = document.getElementById('root') as HTMLElement

  // create the React root node and render the application
  ReactDOMClient.createRoot(rootElement).render(
    <React.StrictMode>
      <SnackbarProvider>
        <RouterProvider router={router} />
      </SnackbarProvider>
    </React.StrictMode>
  )

  // if NODE_ENV is production, return early. otherwise, run dev tools.
  if (process.env.NODE_ENV === 'development') {
    console.debug(SIGN_IN_GREETING, CONFIG)
    // console.log(`Running in environment: ${process.env.NODE_ENV}`)
    // enable React performance measurement tools.
    // see https://create-react-app.dev/docs/measuring-performance/
    const { onCLS, onFID, onFCP, onINP, onLCP, onTTFB } = await import(
      'web-vitals'
    )

    onCLS(onPerfEntry)
    onFID(onPerfEntry)
    onFCP(onPerfEntry)
    onINP(onPerfEntry)
    onLCP(onPerfEntry)
    onTTFB(onPerfEntry)
  }
})()
