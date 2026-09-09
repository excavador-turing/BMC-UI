# Changelog

The BMC web interface, as built by this fork. Upstream's history is in the git
log; this file starts where the fork diverges, at 3.3.7.

The interface ships to a board inside a firmware release, pinned by commit, so
a version here only reaches hardware once `BMC-Firmware` bumps that pin.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [3.8.0] — 2026-09-09

### Fixed

- **"Check now" never checked** (SQU-132). `useFirmwareAvailableQuery` sent no
  `refresh`, and the button called `refetch()` — which replays the same request
  and gets the daemon's half-hour cache back. The one control whose entire
  purpose is to bypass that cache was the one control that did not. Its own doc
  comment already described the intended behaviour; it had never been
  implemented.

  It now sends `refresh=1`, and because the daemon answers at once and
  re-polls behind itself (bmcd 2.11.0), the page polls every two seconds while
  `refreshing` is set and stops when it clears. The spinner is on the button;
  the list underneath stays readable and scrollable.
- **A failing `type=about` blanked the entire application.** `BasicInfo` is a
  `useSuspenseQuery` mounted in the header of *every* route, wrapped in a bare
  `<Suspense>`. Suspense handles a promise that is *pending*; one that is
  *rejected* is thrown during render and passes straight through — so a single
  failed request unwound past the header, past the route, and past the root,
  none of which had a boundary. A daemon that is briefly busy should cost the
  header, not the page someone is working on.
- The `about`, `nodes` and `usb` routes had a `pendingComponent` but no
  `errorComponent`, so they had the same hole. `info`, `network` and `console`
  already had one.
- **The header and the About page named the firmware version "daemon"**
  (SQU-155). Read from the board: `about` reports `version` = `v2.8.1-rc1`, the
  **firmware**, and `bmcd_version` = `2.12.0`, the daemon. The firmware release
  was shown under the daemon's name on every page, and the daemon's own version
  was not shown anywhere. About now names both, and `Build version` appears only
  when it differs from the daemon version rather than repeating the row above
  it.

### Added

- `ErrorBoundary`, the one class component in the application, because catching
  a render error requires a class. Local rather than a dependency: it is twenty
  lines and the alternative was a package on the critical path of every page.
- The catalogue's `refreshing` and `age_seconds` from bmcd 2.11.0. Both are
  optional, so an older daemon that never sends them behaves as before.
- New strings in all six locales, not only English.

## [3.7.0] — 2026-09-08

### Added

- Pick a version to install: the firmware page lists what every configured
  source offers, with how each compares to the running version and how much is
  known about its integrity, and sources are editable in place.

### Changed

- Node 24, TypeScript 6, Vite 8, ESLint 10, and all twenty advisories cleared.
- The release is a tarball with `SHA256SUMS`; upstream's auto-release is inert.

[Unreleased]: https://github.com/excavador-turing/BMC-UI/compare/v3.8.0...hive
[3.8.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.8.0
[3.7.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.7.0
