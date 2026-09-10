# Changelog

The BMC web interface, as built by this fork. Upstream's history is in the git
log; this file starts where the fork diverges, at 3.3.7.

The interface ships to a board inside a firmware release, pinned by commit, so
a version here only reaches hardware once `BMC-Firmware` bumps that pin.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [3.19.0] — 2026-09-10

### Removed

- **The red maskrom warning on the flash page** (SQU-157, closing with
  SQU-105). It said the daemon writes to whichever module is in maskrom first
  and reports success, whatever the picker says. That was true and is not any
  more.

  Proven on the board on 2026-09-10 before removing it: with **two** modules in
  maskrom at once, flashing node 2 left node 4 answering `talosctl` with the
  cluster's certificate authority while node 2 rejected it as unknown — a node
  that was overwritten cannot present the cluster CA, and one that was not
  cannot fail to. The write landed where it was aimed.

  SQU-157 said to remove it in the change that closes SQU-105, and a warning
  that is no longer true is worse than no warning: it teaches people to ignore
  the red ones.

  The component, its use, and its three strings in all six locales are gone.

## [3.18.0] — 2026-09-09

### Changed

- **The API types are generated from the daemon's own document** (SQU-179).
  Twenty-three hand-written interfaces became aliases onto
  `src/lib/api/schema.d.ts`, produced by `openapi-typescript` from the
  `openapi.json` that bmcd 2.28.0 publishes. `npm run api:refresh` regenerates
  it from the release named in `bmcd-release.txt`.

  Proven load-bearing rather than decorative: renaming one field in the
  generated file fails the build in twelve places across two components.

- **The hooks stay hand-written**, deliberately. Which endpoint uses a suspense
  query and which must not is a decision with a reason — a suspense query that
  throws takes the whole route to its error component, which is how a single
  failed `about` used to blank the interface. Only the types changed.

- **Numeric readings are now handled as absent-or-null, not merely null.** The
  generated types are stricter than the hand-written ones were, because
  `schemars` cannot distinguish a field always sent as `null` from one omitted
  when empty: both are `Option<T>` in Rust. Rather than assert a guarantee the
  document does not make, the interface treats both as "no reading" — which is
  what it already did at runtime, through `Number.isFinite`. That is not a type
  guard, so the compiler could not see it; `isReading` is.

### Added

- **CI regenerates the types and fails on any difference**, catching both a
  hand edit to a generated file and a pin moved without regenerating. Neither
  would fail `tsc`; the types would simply describe an API the board no longer
  serves.

### Fixed

- **`quality.yml` now runs on pushes to `hive`, not only on pull requests.**
  This fork pushes straight to the branch, so lint, build and tests had not
  been running in CI here at all. `Tag and Build` looks like a safety net and
  is not: it is fenced to `github.repository == 'turing-machines/BMC-UI'` and
  triggers on `main`. Only `Release` ran, on tags, by which point the release
  is already public.

## [3.17.0] — 2026-09-09

### Removed

- **The Metrics token card** from Settings, with its query, its rotate
  mutation and its strings in all six languages (SQU-178). `/metrics` moved
  to its own listener on port 9110 and takes no credential, so there is no
  token to show, reveal, copy or rotate.

  A card offering to rotate a credential that no longer guards anything would
  be worse than no card: it would imply a protection that is not there.

## [3.16.0] — 2026-09-09

### Changed

- **The standing explanations move behind an (i)** (SQU-161). Every page
  carried paragraph-length notes between its controls — what an eraseblock is,
  why the fan's duty table is not linear, why the console's reader state is
  about the BMC rather than the module, why the REST writer cannot send a
  Ctrl-C. They were true, and an operator on the Firmware page at two in the
  morning is not there to learn about UBI.

  Each is now one sentence in a popover beside the reading it explains, with a
  link to the full version on the docs site. Seven notes in total, across board
  health, the fan, node liveness, the firmware slots, the scrape credential and
  both console pages.

- **Warnings and confirmations deliberately did not move.** A maskrom warning,
  a "this cuts power to the modules" dialog and a reset-network confirmation
  are information needed at the moment of deciding, and putting them behind a
  click would be hiding them rather than tidying them. The rule is: standing
  explanation beside a reading becomes an (i); consequence of a button stays
  where it is.

  The fan's governor note also stays inline, because it now renders only on a
  daemon that cannot hold a step — where it is a live caveat about the slider
  directly beneath it, not a standing fact.

### Added

- A small popover of our own rather than a new Radix dependency. The firmware
  image size is a CI gate, and this is one pattern: a button, a panel, Escape
  and outside-pointerdown to dismiss, focus returned to the trigger.

## [3.15.0] — 2026-09-09

### Changed

- **The fan slider now sits behind an explicit Override switch** (SQU-170).
  The step, the duty and the governing trip are the read-only default. Turning
  Override on pauses the kernel's governor, and the card says so in plain
  words, including that the daemon will hand the fan back on its own above the
  board's hottest active trip.

  The slider was a control that lied. The governor is `step_wise` and took the
  fan back within a poll of any change, so a person dragged it to 6, watched it
  return to 4, and filed the report that opened SQU-135. Turning the switch on
  does not move the fan: the step it is on becomes the step it is held at, so
  the only thing that changes is who decides it.

- **The switch appears only where a step would actually hold** — where the
  daemon reports both a governor it can pause and the state of that governor.
  On an older daemon the plain slider and its note stay exactly as they were.
  A switch that did not hold would be worse than the slider, because the
  slider at least sits under a note admitting the governor undoes it.

- **The header says `governor paused` while a fan is held**, where it
  otherwise says `automatic`.

## [3.14.0] — 2026-09-09

### Changed

- **Install OS is red** (SQU-161's colour rule). Writing an OS image overwrites
  whatever the module was booting from and is the most destructive action in
  this interface. It was lime, which here is the colour of Save.

- **The confirmation dialog commits in red**, matching the reboot dialog it
  sat beside. Every caller of it is confirming something consequential —
  flashing a module, resetting the network, restoring a config, renaming the
  board — which is why they ask at all, so a lime Continue was the wrong
  colour at the moment of commitment. Both the desktop dialog and the mobile
  drawer.

### Fixed

- **The firmware sources editor no longer breaks at 390 px** (SQU-161). The
  location field's 16 rem minimum forced it onto its own line and left the
  delete button orphaned below. Small screens now stack one field per row with
  delete as a trailing icon on the label's row, and `sm:contents` dissolves
  that wrapper above `sm` so the desktop layout is the single flex row it
  always was.


## [3.13.0] — 2026-09-09

### Fixed

- **After an upload the interface offered a reboot that would have done
  nothing** (SQU-134). The browser's upload was changed to *park* the image on
  the SD card rather than install it, but the completion path still spoke the
  language of the old upload-and-stage flow: it opened a modal saying "to
  finalize the upgrade, a system reboot is necessary" and offered to do it.

  Nothing is staged after a park, so that reboot applied nothing. Worse, it
  taught the operator that parking and installing were one step when the whole
  point of the change was to separate them.

  The modal is gone, along with the reboot mutation and the two strings behind
  it in all six locales. The success message now says what happened: the image
  is on the SD card and listed in the version list, where installing it is a
  separate choice.


## [3.12.0] — 2026-09-09

### Fixed

- **The interface told you the compute modules would lose power, and they do
  not** (SQU-133). Two live places said it, in all six languages: the reboot
  confirmation on Settings, and the modal shown after a firmware upload
  finishes. It is upstream's text, from a board where a BMC reboot did cut the
  node rails; this fork's does not, which is one of the things it exists for.

  Measured before changing it. The BMC rebooted at 13:11 UTC to take v2.12.0
  and the four modules never left `Ready` — their last transition was 12:39,
  the earlier power cut. So the modules ride a BMC reboot, and the interface
  now says what actually happens: the modules keep running, and this UI, the
  API and the consoles go away for about half a minute.

  A dead `info.rebootModalDescription`, carrying the same claim, is removed
  from all six locales.

### Added

- **The Settings reboot says when a firmware is staged** (SQU-133). Rebooting
  from there applies a staged image exactly as the Firmware tab's button does,
  and nothing on the page said so — you could reboot for an unrelated reason
  and silently take an update you had forgotten was waiting. Now the button
  carries an amber line naming the version, and the confirmation repeats it.

  Only an explicit `update_staged === true` warns. The field is three-valued,
  and "the boot environment could not be read" is not a reason to claim an
  update is pending.


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
