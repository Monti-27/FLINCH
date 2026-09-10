# Railway configuration

`railway.ts` imports the existing project without exposing secrets. Existing variables use `preserve()`. Read [the hosting guide](../docs/RAILWAY.md) before changing it.

Run `railway config plan --detailed-exit-code` from the linked root to check drift. A no-change plan was verified with CLI 5.49.6 and the pinned SDK. Review and approve an exact plan before applying it; application releases do not need an infrastructure apply.

Repository-less GitHub source types preserve disconnected-service metadata. They do not connect either service to a repository. Use the root `railway:deploy` script until a reviewed GitHub connection is configured.

Never use `config pull --include-variables`, store secrets here, or restore a database volume without an approved recovery plan. This project does not use deprecated `railway.json` or `railway.toml` files.
