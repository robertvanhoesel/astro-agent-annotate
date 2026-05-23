# Repository Instructions

## Release Process

- Use Changesets for release intent. For any user-facing package change, add a changeset with `pnpm changeset` and choose `patch`, `minor`, or `major`; do not hand-edit `package.json` just to bump the version in a feature/fix PR.
- Feature/fix PRs should include the source change and the generated `.changeset/*.md` file. After merge to `main`, the `Version Packages` GitHub Action opens or updates a version PR that runs `pnpm run version-packages`.
- Publishing happens only after the version PR is merged to `main`. The publish workflow uses npm Trusted Publishing via GitHub OIDC, not an npm token.
- After a successful npm publish, the publish workflow creates and pushes a git tag matching the published package version, for example `v0.0.1`.
