@echo off
if "%1"=="" goto usage

set lt_tests=%1

:repeat
call node_modules\.bin\cypress.cmd run --record false --spec  "cypress\integration\%lt_tests%"
if ERRORLEVEL 1 goto eoj
goto repeat

:usage
echo ERROR- Missing path and file name of spec file to run.
echo Runs all specified tests in a loop until there is a failure. Examples:
echo.   All Smoke tests        --- npm run loopTests Smoke\**\*.spec.js
echo.   Single Regression test --- npm run loopTests Regression\EntityLabeling\LearnedEntityLabeling.spec.js

:eoj
