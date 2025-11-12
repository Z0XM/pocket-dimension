# Changesets

This monorepo uses [Changesets](https://github.com/changesets/changesets) to manage versions and create changelogs.

## Adding a Changeset

When you make changes that should be released, you need to add a changeset:

```bash
bun run changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of the changes

The changeset will be created in `.changeset/` directory.

## Versioning

To version packages based on changesets:

```bash
bun run version
```

This will:
- Update package versions based on changesets
- Update CHANGELOG.md files
- Remove used changesets

## Publishing

To publish packages (if publishing to npm):

```bash
bun run release
```

**Note**: This is currently configured for private packages. Update the `access` field in `.changeset/config.json` if you plan to publish publicly.

## Workflow

1. Make your changes
2. Add a changeset: `bun run changeset`
3. Commit the changeset file
4. When ready to release, run `bun run version`
5. Review and commit the version changes
6. If publishing, run `bun run release`

## CI Integration

The CI workflow will check for changesets in pull requests and can be configured to:
- Verify changesets exist for changed packages
- Automatically version and publish on merge to main
