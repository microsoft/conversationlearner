@echo off
if "%1"=="" goto usage

set rt_tests=%1

echo Starting Cypress test runner for: "cypress\integration\%rt_tests%"
call node_modules\.bin\cypress.cmd run --record false --spec  "cypress\integration\%rt_tests%"
goto eoj

:usage
echo ERROR- Missing path and file name of spec file to run.
echo Runs all specified tests. Examples:
echo.   All Smoke tests        --- npm run loopTests Smoke\**\*.spec.js
echo.   Single Regression test --- npm run loopTests Regression\EntityLabeling\LearnedEntityLabeling.spec.js

:eoj
