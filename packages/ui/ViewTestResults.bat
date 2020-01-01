@echo off
if "%1"=="" goto usage

node src\testResultReporting\TestResultAnalyzer.js %1
goto eoj

:usage
echo ERROR: Missing build number
echo.
echo USAGE: ViewTestResults [build-number]
echo You will find the build number on the page https://circleci.com/gh/microsoft/conversationlearner.
echo Be sure to select the build number that coresponds to either a "test-smoke" or "test-regression" run.
echo.
echo NOTE: You must have a .env file in the root folder (..\..\.env). It must contain an entry like this...
echo.         circle-token=[token]
echo.      to create the token go to https://circleci.com/account/api
:eoj