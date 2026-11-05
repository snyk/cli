---
description: The snyk uninstall command that runs the post-install actions provided by extensions
---

# Uninstall

## Usage

`snyk uninstall`

## Description

`snyk uninstall` runs post-install actions provided by extensions, not package installs.

Each extension registers its actions as steps for the uninstall lifecycle. The steps currently run in ID order, but do not rely on that order. Each step runs with its defaults; no arguments are passed to them. If no extension provides a step, the command succeeds and does nothing.

A failing step does not stop the other steps. If one or more steps fail, the command returns an error that lists each failed step and its message. Fix the cause named in each message, then run the command again.

## Debug

Use the `-d` option to output the debug logs.
