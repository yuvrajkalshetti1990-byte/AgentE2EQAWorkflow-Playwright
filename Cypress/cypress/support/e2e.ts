// Cypress support file — loaded before every spec.
// Add global hooks, custom commands imports, and third-party plugin setup here.

import './commands';

// Required by cypress-mochawesome-reporter (Assignment 20).
// Install: npm install cypress-mochawesome-reporter --save-dev
import 'cypress-mochawesome-reporter/register';
