// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import '@testing-library/cypress/add-commands'
import './commands'
import './safe-apps-commands'
// Alternatively you can use CommonJS syntax:
// require('./commands')

/*
 FIXME: The terms banner is being displayed depending on the cookie banner local storage state.
  However, in cypress the cookie banner state is evaluated after the banner has been dismissed not before
  which displays the terms banner even though it shouldn't so we need to globally hide it in our tests.
 */
before(() => {
  cy.on('window:before:load', (window) => {
    window.localStorage.setItem('SAFE_v2__show_terms', false)
    // So that tests that rely on this feature don't randomly fail
    window.localStorage.setItem('SAFE_v2__AB_human-readable', true)
  })
})
