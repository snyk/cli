# Notes on #project-envelope spike in the CLI #

```text
> CLI
  > plugins
    + modular, plug-and-play
    - CLI needs to support backwards compatibility - there is no incentive to upgrade older plugins to a newer interface if they just work
    - new changes need to be introduced in ALL plugins to reap the benefits

> Registry
  > endpoint for payloads
    + should deal with all the processing that currently happens in the CLI
```

problems with the current interface:

- it's great to abstract payloads like this, but when you have to work with something concrete it becomes difficult to extract it
- lots of processing should probably move to the backend instead of happening in the CLI
