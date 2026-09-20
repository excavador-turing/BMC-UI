# Changelog

The BMC web interface, as built by this fork. Upstream's history is in the git
log; this file starts where the fork diverges, at 3.3.7.

The interface ships to a board inside a firmware release, pinned by commit, so
a version here only reaches hardware once `BMC-Firmware` bumps that pin.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **The demo shows the switch and the Security tab.** Both hid themselves on
  a daemon that answers 404 to `/api/bmc/network/switch` and `/api/bmc/access`
  -- which is exactly what the demo answered, because `capture-fixtures.sh`
  only knew the legacy `?type=` reads. It captures the four path-style
  endpoints now (the switch document and its presets, the certificate the
  board serves, who may reach it), and the adapter serves them; every write on
  a path-style endpoint, and the validate call -- a judgement only the daemon
  can make -- is refused with the demo's own problem+json. The sanitiser
  learned what those captures carry: the board's name, the estate's domain,
  its CA name and two fingerprints; the leak guard hunts those too.

  Fixtures re-captured from a board on firmware v2.33.0.

## [v3.32.0] — 2026-09-21

### Changed

- **Which module: four pills, not a drop-down.** Console, USB and Flash each
  opened with a list that unfolded to show four fixed entries, one of them
  already chosen -- a click and a scan to answer a question the page could
  have asked in one row. The three tabs now share one `NodePicker`: Node 1
  to 4 side by side, the chosen one green, keyboard-reachable as a radio
  group. The flash form still reads the module by field name; a hidden
  input carries it where the select used to.

## [v3.31.0] — 2026-09-21

### Fixed

- **The fleet says which version of itself it is.** `Dockerfile.fleet` has
  taken a `BMC_UI_VERSION` build argument since the image existed, and the
  release workflow has been passing the tag into it all along — but it was set
  as a plain `ENV`, and **Vite only puts `VITE_`-prefixed variables into the
  bundle**. So the value arrived at the build and stopped there.

  The cost was not cosmetic: the deployed fleet sat **two releases behind**
  with nothing on the page able to say so. It is in the header now, beside the
  name.

- **The fleet has a footer, and a mark of its own.** It is a separate entry
  point built from this same tree and never renders the board's root route, so
  it had no logo, no version and no footer — which also meant the upstream
  copyright notice, which is there for a legal reason, was missing from one of
  the two things this repository ships. The footer is now a shared component
  used by both.

- **The docs link pointed at a dead host.** `turing.excavador.xyz` has not
  answered for some time; the documentation is at `turingpi.xyz`.

## [v3.30.0] — 2026-09-20

### Added

- **The confirm window is settable, beside the buttons it belongs to.** The
  daemon has accepted `window_s` per apply since the switch landed — 10 to 300
  seconds — and publishes its own default and range; `tpi` has `--window`. The
  card sent neither, so every apply, **including Try it**, silently got 30
  seconds.

  Thirty is enough to watch a preset take effect and too short to check a
  layout you made by hand, which is exactly when Try it is worth using.

  The bounds come from the board's published limits, never from a number in
  this page, and an untouched control sends no `window_s` at all so the board
  keeps deciding. An out-of-range value greys the button out rather than being
  sent to be refused, and the Apply confirmation quotes the number it will
  actually use.

### Changed

- **Network, Security and Settings each fit a laptop window now.** Measured on
  bmc-2 at 1280×800, where a tab has 744 px of usable height: Network was
  1149 px, Access 1670, Settings 942. **All three are 800 px** — no scroll.

  The cause was shared: every tab stacked full-width cards down a 1280 px
  screen, so pages made of three or four short cards scrolled while half the
  window stayed empty. `TabView` takes a `columns` prop and lays them out in
  two columns at `xl`, where a column is still wide enough for a form. Below
  `xl` nothing changes — two columns at 768 px would be two cramped ones.

- **The hostname moved to Network, and Access became Security.** A board's
  name is a network fact: it is how you reach it, it is in the certificate's
  subject-alternative names, and it is what the board advertises over mDNS. It
  sat on a different tab from the addresses it belongs with.

  With it gone, the honest name for what is left — the password, the trusted
  proxy, the certificate — is **Security**. That name was considered and
  rejected one release ago for the good reason that a hostname is not a
  security setting; moving the hostname is what makes it right.

- **Addresses are one line per interface**, not three definition rows. The
  device, its address and its MAC are one fact about one thing.

- **Installing a certificate is behind a disclosure.** Two PEM boxes were
  250 px of a card whose everyday job is answering *what certificate does this
  board serve, and when does it expire*.

- **The switch's link column reads `1 Gb`**, not `1000 Mb/s · full duplex` —
  which was most of the table's width and pushed it into a horizontal
  scrollbar inside a column. Half duplex still shows, in amber, because a
  gigabit port that negotiated half is a bad cable.

### Changed

- **The fleet's chrome on a phone: 301 px to 121 px.** Measured on the demo
  build at 390×844, a board inside the fleet spent **more than a third of the
  viewport** on three stacked rows — a header with a three-line subtitle, the
  board switcher wrapped to two lines, and ten tabs wrapped to four — before
  the first thing anybody came to look at.

  Both rows now **scroll rather than wrap**. That is not only about height: a
  row that wraps moves every tab sideways when a board is added, which is how
  somebody ends up on Settings having aimed at Network. The subtitle is
  orientation rather than instruction, and is kept where there is room for it.

  Desktop is unchanged at 137 px, which it already was: the fleet has its own
  header and never rendered the board's, so it did not pay the 182 px the
  board tab bar used to cost. That is worth saying because the ticket assumed
  otherwise — the fleet's problem was the phone, and only the phone.

### Security

- **A board still on the password it shipped with shows one page and nothing
  else.** Every board leaves the factory as `root` / `turing`, which is
  printed in the quick-start guide and identical on every board anyone has
  bought — so a board that has not had it changed is a board anybody who can
  reach it can administer.

  The daemon refuses everything but logging in and changing it, so without
  this page the interface would render every tab as an error and leave the
  operator to work out why. Not a banner over the ordinary interface: a banner
  is a thing people close.

  The page asks for the current password like any other change, which on this
  board is the published one. That is one more field to type and it keeps a
  single code path, rather than a "first time" route that skips a check.

  It says, because it is one account: the new password is also the SSH
  password for the board.

  The strings are English in every locale, for the reason the `access` strings
  already are — this is the page that tells somebody their board is open to
  anyone who can reach it, and a guessed translation of that is worse than a
  sentence they can look up.

  A board on an older daemon sends no `factory_password` at all, and nothing
  changes for it: that daemon refuses nothing, so a page saying otherwise
  would simply be false.

### Added

- **A page-length gate in CI.** `scripts/screens.py` measures every tab at
  1280×800 and 390×844 on every pull request and fails on a header over
  64 px, a tab over two screens, or a horizontal scrollbar at phone width.
  Console is exempt: a terminal is meant to be tall.

  Against the **demo build**, so no board is involved — the captured fixtures
  answer, and a card whose endpoint they lack hides itself exactly as it does
  on an older board. That also means the gate undercounts Access and Network
  by the access, certificate and switch cards, which is said in the script
  rather than left for somebody to discover; capturing those endpoints from a
  board closes it.

  A baseline holds what is over the line today and is checked **both
  directions**, so a fault that gets fixed and left in the baseline fails too.
  It keys on the fault, never on the pixel count: a baseline holding numbers
  would fail on a one-pixel move, and a gate that cries every day gets
  switched off.

  `npm run screens` runs it locally; `npm run screens -- --record` re-records.

### Changed

- **The Firmware tab shows the newest release per source, not three.** Four
  sources at three rows each was twelve rows of catalogue; the question the
  page exists to answer is *is there something newer than what I am running,
  and where from*. Each source now shows its newest, with **show all N**
  opening the rest of that source in place. Nothing on offer changed, only how
  much of it is open at once — and a source that returned an error still shows
  the error where its row would be, because an empty list and an unreadable
  one are different answers.

### Added

- **An Access tab: what this board is called, and who may reach it.** The
  hostname, the password and trusted proxy, and the certificate this board
  serves, moved out of Settings into a tab of their own between Network and
  Firmware. Reading one of the three usually means reading the next.

  "Security" was considered and rejected: a hostname is not a security
  setting, and a tab whose name is wrong for a quarter of what it holds is a
  tab people do not look in.

### Changed

- **Settings is a page again: 3014 px to 942 px** at 1280×800, four screens to
  just over one. Three cards went to Access, and **Firmware sources stopped
  being rendered on two tabs** — the same editor was on Settings and on
  Firmware, and it only ever belonged where the sources are used. What is left
  is time, the fan, backup and restore, and the two buttons that touch the
  whole board.

- **One header bar, with the tabs inside it: 126 px back on every page.**
  Measured on bmc-2 at 1280×800, the logo block was 128 px and the tab strip
  beneath it another 54 px, so every tab began 182 px down and a laptop showed
  618 px of content out of 800. It is now 56 px, and the tabs are in it.

  The board's name and firmware version stay — they are how you know which
  window you are typing into — on one line beside the logo rather than under
  it. The active tab is underlined rather than drawn as a tab, because inside
  a header bar there is no strip for it to be part of.

  Between `md` and `xl` the strip stays: seven tabs plus the board's name do
  not fit beside each other at 768 px, and tabs that wrap are worse than tabs
  on a row of their own. Below `md` nothing changes at all — logo, name,
  hamburger, tabs in the drawer.

- **The switch table is editable, and it is the only table on the Network
  tab.** Presets fill it; they are no longer the only thing you can ask for.

  Pick Flat, Split or Trunk and the cells populate from the board's own
  expansion. Then change any of them: each port's untagged VLAN is one box,
  its tagged VLANs a comma-separated list, and spanning tree and VLAN
  filtering are switches under the table. There is no Custom mode to enter,
  because there is no mode — **the table is the configuration and a preset is
  a starting point.**

  **The board judges every edit, and this page judges none of them.** The
  whole table goes to `POST .../network/switch/validate` as you type; a
  refusal disables Apply and is shown in the board's own words, and each
  warning sits beside the port it is about. The one judgement the client makes
  is whether what you typed is a number, because that is about text rather
  than about switches. A copy of the board's rules in here would eventually
  disagree with the board, and the way that disagreement surfaces is a board
  nobody can reach.

  **Try it** applies a change with no intention of keeping it. Watch what you
  reach the board by, see whether it still works, and let the window run out.
  For a hand-made layout it is the only honest dry run: the alternative is
  finding out by being locked out.

  **VLANs can be named** — a word beside each number, carried in the document
  the board persists. A table of bare numbers is not a layout anybody can read
  a year later.

  **One table, not two.** Link state and VLAN membership were separate panels
  about the same seven ports, so answering *is node 3's cable in, and which
  network is it on* meant matching names between them. They are now one row
  per port: link, negotiated rate, untagged, tagged — with traffic and error
  counters one click away. The unprobed-port alarm moved with them, and the
  table still renders on a board whose daemon has no switch configuration at
  all, because link state is the older feature and the one people arrive
  looking for.

  **The BMC's own row cannot be given a tagged VLAN.** The board refuses such
  a document; a box you cannot type in says so before it has to.

  Under Confirm, one line about where a confirmation has to come from: the
  browser you reach this board with, never a shell on the board itself. The
  daemon refuses the latter outright.

### Added

- **The switch on the Network tab: what it is doing, and how to change it.**
  The most-asked feature on the public roadmap, and the one with the sharpest
  failure — a wrong VLAN on the BMC's own port takes the board off the
  network, and the thing you would use to undo it is this page.

  So the card never applies anything it keeps. An apply puts the change on the
  switch and starts a window; confirming is a second request, and the fact
  that it arrives at all is the proof that the new configuration works. If the
  page cannot reach the board there is nothing to press, the board puts the
  old configuration back by itself, and the next load says *your change at
  12:03 was put back because it was not confirmed in time*.

  **The countdown does not start until the uplink forwards**, and the card
  says which of the two it is waiting on. Spanning tree holds a port for its
  own delay before it passes traffic, so a countdown started at the apply
  would be counting down to a revert nobody could prevent.

  The table shows all seven ports as they sit on the board, coloured by the
  VLAN each is untagged in, with the BMC's own row marked. Colours are
  assigned by order of appearance rather than by VLAN number, because the
  numbers are the operator's and under Split they are internal ones nobody
  should be reading.

  **The card never expands a preset itself.** The board returns each preset's
  full table and this shows it. A client that computed its own would
  eventually disagree with the board about what a preset means, and that
  disagreement is a board nobody can reach.

  Six locales. Needs a daemon with `/bmc/network/switch`; on an older board
  the card hides itself rather than appearing broken.


### Added

- **The page notices when the board goes away, and notices when it comes
  back.** Until now neither happened. Every polling query uses
  `refetchInterval: (query) => (query.state.error ? false : N)`, which stops
  the interval **permanently** on the first error — so a BMC reboot silenced
  every query and nothing resumed when the board returned. A reboot the page
  itself started ended at a toast, and the tab held stale data until somebody
  reloaded it.

  A banner above the header now says which of two things is happening, because
  only one of them has a number. A reboot this page asked for takes about 48
  seconds — measured, from the upgrade guide's cost table — and says so, with
  a count. A board that stops answering on its own says that instead, with no
  countdown, because nobody promised one.

  The count is a hint and says so when it passes: a board taking longer is
  still coming back, and presenting 48 seconds as a deadline would turn a slow
  reboot into an apparent failure.

  When the daemon answers again the page reloads itself and reports how long
  it took, once. That is also how the number on the upgrade guide gets checked
  by everyone who updates.

  **Only a request that got no response counts as the board being gone.** A
  query that fails with a status is a board that answered: endpoints are
  allowed to refuse, and treating that as a dead board would put an outage
  banner over a healthy one.

  **And coming back is judged by the shape of the answer, not its status.**
  bmcd serves this interface from the same listener and falls back to
  `index.html` for a path it does not route, so a half-started daemon can
  answer 200 with a page of HTML. Reloading on that lands on a page whose
  first real query fails — the very fault this removes.

  Six locales. The demo is excluded: its reboot answers with a refusal wrapped
  in a 200, which the mutation reads as success, so without the guard the
  exhibit would raise a banner and eventually reload itself.


### Changed

- **The console says why it failed, instead of listing three possibilities.**
  A browser exposes nothing about a failed WebSocket handshake — no status, no
  reason, close code 1006 and silence — so the hint named the certificate as
  the likely cause and left the other two for the reader to weigh.

  It does not have to guess. After a socket that never opened, one request to
  the same origin, for the console's own ring buffer, separates all three: an
  answer proves this origin, this session and this daemon's console support
  are all fine, which leaves only a certificate the browser will not open a
  socket to. A 401 is a refused session. Anything else is an unreachable
  board.

  One sentence is shown, with the fix that matches it. The probe runs only
  after a failure, so a console that works costs nothing extra.

  **A 200 is not enough to say the daemon is fine.** bmcd serves the interface
  from the same listener and falls back to `index.html` for a path it does not
  route, so a daemon without the console endpoints answers the probe with the
  interface's own page and a 200. The shape decides, not the status —
  otherwise a board with a perfectly good certificate would be reported as
  untrusted.

  Six locales. The demo never opens a socket, so it cannot reach the probe.


### Added

- **A certificate card on Settings.** What the board serves over HTTPS, and a
  form to replace it with your own. Asked for twice in the Turing Pi Discord
  by people running their own CA, who want a board a browser opens without a
  warning — and a serial console that works, since a click-through certificate
  exception does not extend to the console's WebSocket.

  The card leads with **where the certificate came from**, because that looks
  like a label and is really a question of who renews it. The board reissues
  its own 30 days before expiry and needs nobody. It never touches an
  installed one — deliberately, since replacing an operator's certificate with
  a self-signed one at boot would turn a working deployment into a browser
  warning — so an installed certificate's expiry is a date somebody has to
  diarise, and the card says so in those words.

  It shows the names the certificate asserts, because those are the reason a
  browser accepts or refuses it, and the fingerprint, because it is the only
  field that tells two certificates with the same subject apart.

  Two mistakes are caught before the request: a certificate box that holds no
  certificate, and one that holds a private key as well. The second is the
  dangerous one — it is what `openssl` writes when told to put both in one
  place, and sending it would put the key in a field the board treats as
  public and echoes back.

  A change takes effect on the next connection. Nothing restarts and no
  session is dropped, including the one making the change.

  Needs bmcd with `/bmc/tls/certificate`. On an older board the card hides
  itself rather than appearing broken, by checking the shape of the answer
  rather than its status — an older daemon serves `index.html` for a path it
  does not route, so the status is 200 and the body is a page of HTML.

  Not in the demo: its fixtures are captured from a real board, never written,
  and there is no board running this daemon yet.

## [3.29.0] — 2026-09-13

### Added

- **A node armed for USB boot says so, on its own liveness line.** A module
  whose USB-boot pin is held will not boot from its own eMMC, and from outside
  that is indistinguishable from dead hardware: silent on the serial console,
  off the network, and the board still reporting its rail on. The note leads
  the liveness line, in red, ahead of power state and link state, because both
  of those read perfectly normal in this failure.

  The USB selector on the same card already showed `Flash` for that node. A
  select says what you may *set*, not what is *wrong*, and says nothing about
  the consequence or the remedy; the note beside the warning names both.

### Changed

- **A toast names the board it is about.** With a fleet on one screen,
  "Flashing started" told you an operation began somewhere, and a notification
  from one board was indistinguishable from the same notification from
  another. Toasts raised inside a board's scope now carry that board's name.

## [3.28.0] — 2026-09-12

### Fixed

- **Every reconnect wrote a second copy of the scrollback.** Pressing
  Reconnect kept the terminal, as it is meant to, and then replayed the
  daemon's whole 16 KiB ring buffer underneath what was already there. Seen on
  both interfaces on 2026-09-12 — five lines of `eth0: renamed from ...`, then
  those same five lines again, carrying the same kernel timestamps.

  The replay exists because the daemon forwards only what arrives after a
  subscriber joins, so without it a console opened on a module that has been
  up for hours shows nothing at all. It just never asked whether the terminal
  already had that output.

  Clearing the terminal first would have fixed the duplication and cost the
  thing the scrollback is for: the daemon keeps only the last 16 KiB, and one
  boot is about 82 KB, so the terminal is the only place a full boot survives.
  Instead the replay now works out where what it has already shown ends inside
  the buffer it has just been handed, and writes only what follows — so a
  reconnect with nothing new writes nothing, and a reconnect after a gap
  writes exactly the gap.

  Live frames count as shown too, so output that arrived over the socket is
  not replayed back a second time either.

  Redraw is unchanged and still clears first: it means "show me what the
  module's screen says now", which is a different question.

## [3.27.0] — 2026-09-12

### Fixed

- **The fleet's serial console connects.** It was one gate away: the
  certificate path was already wired end to end, and the interface refused
  before trying.

### Added

- **Settings can say who may get in.** The access card: how you arrived, the
  password for the local account, and the certificate authority a proxy must
  hold to name you — the first time either half was visible from the
  interface, let alone changeable there.

## [3.26.0] — 2026-09-12

### Changed

- **The temperature moved to Board Health.** It was filed under Settings,
  inside the fan card — a reading beside a control — so somebody asking "is
  this board hot?" opened the tab called Board Health, found five other
  numbers, and concluded the board could not tell them. It now sits with
  uptime, load, memory and the clock, and shows the trip point that explains
  the fan's step, because a step with no reason beside it reads as arbitrary.

### Fixed

- **The console hint names what actually breaks it.** A browser will not open
  a WebSocket to a certificate it does not trust, and the exception you
  granted by clicking through on the page does not extend to that connection.
  The hint led with a rejected token and a daemon too old to serve the
  endpoint; both are possible and neither is what people hit.

## [3.25.0] — 2026-09-12

### Added

- **Choose an image off the SD card.** A 2 GB image is usually already on the
  board's own card, and installing it meant typing its path from memory into a
  field and finding out minutes later whether you had. The picker lists what is
  there, marks what can be written to a module, and says why the rest cannot.

### Fixed

- A button on the flash page that had never worked.

## [3.24.0] — 2026-09-11

### Changed

- **Installing firmware asks in a modal**, not in a confirmation that appeared
  below the version list where the reader was not looking.

## [3.23.0] — 2026-09-11

### Added

- **The fleet can drive a board, not just describe one.** It shipped as an
  overview — tiles, versions, uptime, nothing you could press — and a status
  page is not what removes the need to open eight tabs. First pass at parity
  with the board's own interface.

### Fixed

- **Stop escaping the daemon's messages twice**, which rendered `&#x2F;` where
  a slash belonged on the Firmware page.

## [3.22.0] — 2026-09-11

### Added

- **The fleet: one interface over every board**, and the image and chart that
  deploy it. A board that can reflash four computers should not face the
  internet; the fleet is the thing that is exposed instead, and it holds no
  credential of its own.

### Changed

- **The site is not told what shipped; it looks.** The demo the site serves is
  built from the latest release rather than committed by hand.

## [3.21.0] — 2026-09-11

### Fixed

- **The four modules fit the demo frame too.** The same one-screen fix as
  3.20.0, in the frame the site embeds.

## [3.20.0] — 2026-09-11

### Added

- **A release tells the site**, so a new interface reaches turingpi.xyz
  without anyone remembering.

### Changed

- **The four modules fit on one screen.** The node cards had grown past the
  height a laptop has.

### Fixed

- **The demo answers from fixtures instead of a board**, so the interface on
  the site is the real bundle with captured data behind it rather than a
  build that tries to reach hardware that is not there.

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
