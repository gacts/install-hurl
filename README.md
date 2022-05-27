<p align="center">
  <img src="https://user-images.githubusercontent.com/7326800/170708958-a0986e48-c467-4a48-91a2-b451f5397feb.svg" alt="Logo" width="250" />
</p>

# Install [hurl][hurl] action

![Release version][badge_release_version]
[![Build Status][badge_build]][link_build]
[![License][badge_license]][link_license]

This action installs [hurl][hurl] as a binary file into your workflow. It can be run on **Linux** (`ubuntu-latest`), **macOS** (`macos-latest`), or **Windows** (`windows-latest`).

- 🚀 Hurl releases page: <https://github.com/Orange-OpenSource/hurl/releases>

Additionally, this action uses GitHub **caching mechanism** to speed up your workflow execution time!

## Usage

```yaml
jobs:
  install-hurl:
    runs-on: ubuntu-20.04
    steps:
      - uses: gacts/install-hurl@v1
        #with:
        #  version: 1.2.0 # `latest` by default, but you can set a specific version to install, e.g.: `1.6.0`

      - run: hurl version # any hurl command can be executed
```

## Customizing

### Inputs

Following inputs can be used as `step.with` keys:

| Name           |   Type   |        Default        | Required | Description                                                |
|----------------|:--------:|:---------------------:|:--------:|------------------------------------------------------------|
| `version`      | `string` |       `latest`        |    no    | Hurl version to install                                    |
| `github-token` | `string` | `${{ github.token }}` |    no    | GitHub token (for requesting the latest hurl version info) |

### Outputs

| Name       |   Type   | Description                  |
|------------|:--------:|------------------------------|
| `hurl-bin` | `string` | Path to the hurl binary file |

## Releasing

New versions releasing scenario:

- Make required changes in the [changelog](CHANGELOG.md) file
- Build the action distribution (`make build` or `yarn build`)
- Commit and push changes (including `dist` directory changes - this is important) into the `master` branch
- Publish new release using repo releases page (git tag should follow `vX.Y.Z` format)

Major and minor git tags (`v1` and `v1.2` if you publish `v1.2.Z` release) will be updated automatically.

## Support

[![Issues][badge_issues]][link_issues]
[![Issues][badge_pulls]][link_pulls]

If you find any action errors, please, [make an issue][link_create_issue] in the current repository.

## License

This is open-sourced software licensed under the [MIT License][link_license].

[badge_build]:https://img.shields.io/github/workflow/status/gacts/install-hurl/tests?maxAge=30
[badge_release_version]:https://img.shields.io/github/release/gacts/install-hurl.svg?maxAge=30
[badge_license]:https://img.shields.io/github/license/gacts/install-hurl.svg?longCache=true
[badge_release_date]:https://img.shields.io/github/release-date/gacts/install-hurl.svg?maxAge=180
[badge_commits_since_release]:https://img.shields.io/github/commits-since/gacts/install-hurl/latest.svg?maxAge=45
[badge_issues]:https://img.shields.io/github/issues/gacts/install-hurl.svg?maxAge=45
[badge_pulls]:https://img.shields.io/github/issues-pr/gacts/install-hurl.svg?maxAge=45

[link_build]:https://github.com/gacts/install-hurl/actions
[link_license]:https://github.com/gacts/install-hurl/blob/master/LICENSE
[link_issues]:https://github.com/gacts/install-hurl/issues
[link_create_issue]:https://github.com/gacts/install-hurl/issues/new
[link_pulls]:https://github.com/gacts/install-hurl/pulls

[hurl]:https://hurl.dev/
