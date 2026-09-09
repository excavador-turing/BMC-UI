# Changelog

The BMC web interface, as built by this fork. Upstream's history is in the git
log; this file starts where the fork diverges, at 3.3.7.

The interface ships to a board inside a firmware release, pinned by commit, so
a version here only reaches hardware once `BMC-Firmware` bumps that pin.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [3.11.0] — 2026-09-09

### Added

- **The console replays the module's scrollback when you open it** (SQU-156).
  It used to open blank however long the module had been running: the daemon
  forwards only bytes that arrive *after* a subscriber joins, and the panel
  asked for nothing on connect. Meanwhile bmcd held the last 16 KiB the whole
  time and already served it.

  The panel now reads that buffer and writes it into the terminal *before*
  attaching the websocket, so history sits above live output rather than
  below it. Reading is free: the daemon copies the buffer rather than draining
  it, checked against a board, so this takes nothing away from the socket.

- **A Redraw button.** Clears the terminal and writes the daemon's buffer back,
  which is the answer to "how do I redraw the screen". Clear and Reconnect keep
  their old meanings, so the three buttons now do three different things:
  wipe it, show what the module's screen says, open a new socket.

  Redraw costs local scrollback beyond the daemon's 16 KiB. That is the trade a
  redraw is, and the alternative -- appending a second copy below the first --
  is not what the word means.

  Two details of that endpoint are unlike every other one here and are noted in
  the code: it answers under the key `uart` rather than `result`, and its
  `node` parameter is 0-based, matching the websocket's.


## [3.10.1] — 2026-09-09

### Changed

- **Reset network is red and confirms first** (SQU-161's colour rule). It was
  lime, which in this interface means *safe to press* — and on a headless
  board reached over that same network it is the control most able to end the
  session using it. The confirmation says exactly that, rather than asking
  "are you sure".

  One rule everywhere: lime is safe, red is consequential and confirms.

## [3.10.0] — 2026-09-09

### Added

- **A red warning on the flash page for v2.5 boards** (SQU-157). The page
  offers a node picker and an Install button; on v2.5 the daemon **ignores the
  picker** when more than one module is in maskrom — it writes to whichever
  enumerates first and reports success (SQU-105). The board this fork is
  developed on is a v2.5.2.

  This is the one operation on the whole backlog that destroys data, so the
  warning **fails open**: if the query that reads the board revision fails, a
  general caution is shown rather than nothing. It appears only on v2.5, since
  a warning that is always on is one nobody reads, and it goes in the same
  change that closes SQU-105.
- The rollback slot shows the version a reboot would land on, when bmcd 2.19.0
  reports one. Older daemons still say "not readable", which is what the board
  actually knows.

## [3.9.3] — 2026-09-09

### Fixed

- **The Firmware page's two-second poll is bounded.** While the daemon reports
  `refreshing`, the page re-reads the catalogue every two seconds — and if that
  flag ever stuck, the page polled a 116 MB board for as long as the tab stayed
  open. A tab left on this page overnight became a load generator, which is
  one of the plausible contributors to the board wedging on 2026-09-09
  (SQU-172). Sixty polls now, two minutes, comfortably longer than the slowest
  refresh measured (16 s); after that the page stops asking and shows what it
  has. bmcd 2.18.0 fixes the sticking flag itself; this is the other half.

## [3.9.2] — 2026-09-09

### Changed

- **Each source lists its newest three versions, always; the rest sit behind
  "show N more".** The list used to show only versions newer than or equal to
  the running one, which left a card with nothing in it but a "show 3 older"
  link the moment the board ran something no source offered yet — exactly the
  state right after a release is cut and before it is published. The relation
  badge on each row already says what it is; hiding the row said nothing.
  Expanding is per source, so opening the mirror's long list does not unfold
  the fork's three.

## [3.9.1] — 2026-09-09

### Fixed

- **The USB route selector on the node cards printed its label through its
  value.** `SelectTrigger` always floats its label as a caption above the value
  and reserves the top of a 48 px trigger for it; shrinking the trigger to sit
  in a row of buttons left the caption on top of "Device". Reported from a
  screenshot of the live board. The component gains a `hideLabel` mode that
  keeps the label for assistive technology and draws no caption, and the
  trigger is wide enough for "not routed here".

### Added

- **A Notes link beside Install** for every candidate from a GitHub source,
  opening the release page in a new tab, so what changed can be read before
  deciding to install it. Only where a page exists: a mirror directory and an
  SD card have nothing to read, and a link to nowhere is worse than none.

## [3.9.0] — 2026-09-09

### Changed

- **Seven tabs, ordered by what a person is doing** (SQU-139): Overview, Nodes,
  Console, Network, Firmware, Settings, About. The old eight mixed what you
  *look at* with what you *do*, and four of them — Nodes, Console, USB, Flash
  Node — were about the same four objects with no path between them.
- **Info becomes Overview and changes nothing.** Storage, board health, and
  that is all. The metrics token, the fan and a REBOOT button moved to
  Settings; a destructive reboot at the foot of an information page is the
  wrong neighbourhood.
- **The upload form parks the image instead of installing it** (SQU-134). It
  used to *be* the install, which made it a second path that bypassed the
  version list — someone could upload one image and install another with the
  page never showing which. It now writes to the SD card and the image appears
  in the list like every other candidate.
- **A parked image can be installed from the list.** The row was disabled with
  a hint explaining why; the daemon takes a local image through the transfer
  endpoint, so it is live now. Only the running version is still not
  installable, because there is nothing to do.

### Added

- **A Settings tab** (SQU-159), in the order identity, behaviour, credentials
  and sources, then the two things that touch the whole board.
- **Hostname** as a control (SQU-138), behind a confirmation that says what it
  costs: the name is the metrics `instance` label, so a Prometheus history does
  not follow the board across a rename, and renaming back does not undo it.
- **Time** (SQU-167): the server list with the clock's state live underneath,
  polling, so a server that does not answer shows up in seconds rather than at
  the next page load. It says outright when the firmware is too old to accept a
  list — a setting saved and never read is the one failure showing the servers
  cannot reveal.
- **Configuration backup** (SQU-142). Including the metrics token is an
  explicit choice with the consequence beside it, because it makes the file a
  credential. An import reports per field, never as one verdict: it is not
  transactional, and a single "done" would hide a hostname that took and
  sources that did not.
- **Console, Flash and USB route on every node card** (SQU-160). The first two
  carry `?node=N`, validated in a non-lazy route file because a lazy route
  holds only its component. The USB selector sits on a node's card but is not
  per-node — the board has one bus — so every card that does not hold it says
  which one does, instead of showing a control that looks broken.
- **Reboot to apply, on the staged notice** (SQU-133). The notice named the one
  action it implied and made you go to another page to take it.
- **Why the fan is on the step it is on** (SQU-135). The governor is
  `step_wise`, so the step follows the highest `active` trip the board is
  above, and the display now says which. Shown only when the daemon reports the
  trips; nothing here is a table of assumed temperatures.
- **The footer identifies the fork.** Upstream's notice stays — BMC-UI is
  GPL-2.0 and the attribution is required — with the fork's beside it and links
  to the organisation and the documentation. Nothing in the interface said
  which one it was, so a screenshot in a bug report was indistinguishable from
  upstream's.

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

[Unreleased]: https://github.com/excavador-turing/BMC-UI/compare/v3.10.1...hive
[3.10.1]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.10.1
[3.10.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.10.0
[3.9.3]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.9.3
[3.9.2]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.9.2
[3.9.1]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.9.1
[3.9.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.9.0
[3.8.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.8.0
[3.7.0]: https://github.com/excavador-turing/BMC-UI/releases/tag/v3.7.0
