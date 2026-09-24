const translations = {
  navigation: {
    overview: "Overview",
    dashboard: "Dashboard",
    nodes: "Nodes",
    powerControl: "Power Control",
    console: "Console",
    network: "Network",
    switch: "Switch",
    security: "Security",
    firmware: "Firmware",
    settings: "Settings",
    about: "About",
    // The sidebar's three headings.
    sectionBoard: "Board",
    sectionNetworkAccess: "Network & Access",
    sectionSystem: "System",
    sectionOther: "Other",
    docs: "Docs",
    github: "GitHub",
    cooling: "Cooling",
    maintenance: "Maintenance",
    // Kept so a bookmark or an old link still renders a label. The tabs
    // themselves are the list above.
    info: "Info",
    usb: "USB",
    firmwareUpgrade: "Firmware Upgrade",
    flashNode: "Flash Node",
  },
  userNav: {
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    logout: "Logout",
  },
  login: {
    header: "Login",
    username: "Username",
    password: "Password",
    remember: "Remember me",
    submit: "Login",
    errorCredentials: "Invalid username or password",
    errorUnknown: "An error has occurred. Please try again later.",
  },
  certificate: {
    title: "The certificate this board serves",
    issuedBy: "Issued by {{issuer}}",
    expires: "Valid until {{date}}",
    key: "Key: {{key}}",
    names: "Names: {{names}}",
    sourceSelfSigned:
      "The board issued this certificate itself and reissues it 30 days before it expires, so it never serves an expired one. A browser will warn about it, because nothing else has any reason to trust it \u2014 and the serial console will refuse to connect, since a click-through exception does not cover its WebSocket.",
    sourceInstalled:
      "This certificate was installed, so the board will not touch it \u2014 including when it expires. Renewing it is yours to remember.",
    installHide: "Hide the install form",
    installHeading: "Install your own",
    installNote:
      "For a certificate from your own authority. A browser that already trusts that authority opens this board with no warning, and the serial console works.",
    certPlaceholder:
      "Paste the certificate in PEM form. Intermediates may follow it, leaf first.",
    keyPlaceholder: "Paste its private key in PEM form",
    notACertificate:
      "That does not look like a PEM certificate. A DER or PKCS#12 file has to be converted first.",
    certHoldsKey:
      "That box holds a private key as well as a certificate. Split them \u2014 the key belongs in the box below, and only there.",
    notAKey: "That does not look like a PEM private key.",
    install: "Install",
    installed: "Certificate installed.",
    installedNote: "It is being served now. Nothing was restarted.",
    installFailed: "The certificate was not installed",
    reset: "Use the board's own certificate",
    resetConfirm:
      "The installed certificate and its key are removed, and the board issues its own at once. Browsers will warn again, and the serial console will stop connecting. It takes effect on the next connection.",
    resetFailed: "The certificate was not removed",
    noRestartNote:
      "A change takes effect on the next connection. The board is not restarted and open sessions are not dropped, including this one.",
  },
  factoryPassword: {
    title: "This board is still using the password it shipped with",
    why: "It is printed in the quick-start guide and is the same on every board, so anyone who can reach this board can administer it. Until you change it, this is the only thing the board will do.",
    heading: "Choose a password for {{account}}",
    sshNote:
      "This is one account: the new password is also the SSH password for this board.",
  },
  access: {
    title: "Who may reach this board",
    youAre: "You are here as {{name}}, authenticated by {{scheme}}.",
    viaGatewayNote:
      "The gateway vouched for you with a certificate this board trusts; you are not holding its password.",
    passwordFor: "Password for {{account}}",
    currentPassword: "Current password",
    newPassword: "New password",
    repeatPassword: "Repeat the new password",
    tooShort: "At least 12 characters.",
    noMatch: "The two new passwords are different.",
    changePassword: "Change password",
    passwordChanged: "Password changed.",
    passwordFailed: "The password was not changed",
    sessionsNote:
      "The current password is required even when a gateway vouched for you. Sessions already open keep working \u2014 sign them out separately if that matters.",
    trustedProxy: "Trusted proxy",
    noTrustAnchor:
      "No client certificate authority. Nothing may name an operator on this board's behalf, so only a password or a session token gets in.",
    caExpires: "Expires {{date}}",
    caBundle: "{{count}} certificates in the bundle; all are trusted.",
    identityHeader:
      "An operator's name is read from {{name}} ({{source}}), and only on a connection carrying a certificate from the CA above.",
    identityHeaderPlaceholder: "Header naming the operator (now: {{name}})",
    pemPlaceholder: "Paste a CA certificate in PEM form",
    storeCa: "Store this CA",
    removeCa: "Stop trusting any proxy",
    removeCaConfirm:
      "Every proxied session ends at the next reload, and the fleet will no longer reach this board. A password still works.",
    caStored: "Certificate authority stored.",
    caRemoved: "Certificate authority removed.",
    caFailed: "The certificate authority was not changed",
    reloadRequired: "It takes effect when the daemon reloads.",
    pinnedInConfig:
      "This is set in the board's config.yaml, which the daemon does not rewrite. Change it there.",
    cannotRemoveFromHere:
      "You are authenticated by this CA, so removing it here would end your own session. Do it from the board's own interface with a password.",
  },
  // The Dashboard (Overview) page.
  dashboard: {
    unnamed: "No name",
    stateOn: "On",
    stateOff: "Off",
    poweredOnAgo: "Powered on {{duration}} ago",
    offSinceUnknown: "Off since: not reported",
    attnUpdate: "Firmware {{version}} is available",
  },
  info: {
    userStorage: "User Storage",
    ariaStorageUtilization: "Storage utilization",
    backupButton: "Backup User Data",
    fanControl: "Fan Control",
    bmc: "BMC",
    rebootButton: "Reboot",
    reloadDaemonButton: "Reload Daemon",
    rebootModalTitle: "Do you want to reboot?",
    backupSuccess: "Successfully downloaded backup file.",
    backupFailed: "User data backup failed.",
    rebootSuccess: "The BMC is rebooting...",
    rebootFailed: "Failed to reboot BMC",
    reloadDaemonSuccess: "The BMC daemon is reloading...",
    reloadDaemonFailed: "Failed to reload BMC daemon",
    thermalCelsius: "{{value}} °C",
    thermalAbsent: "not detected",
    thermalUnavailable: "This BMC daemon does not report board temperature.",
    thermalNoSensors:
      "This board reports no thermal sensor, so there is no temperature to read. The fan runs at whatever it was last set to, with nothing to regulate against.",
    fanAutomatic: "automatic",
    fanStep: "{{cur}} of {{max}}",
    fanRequested: "set {{value}}",
    fanGovernorNote:
      "The kernel regulates this fan from the board temperature. This daemon cannot pause it, so a setting here is undone at the governor's next poll, a few seconds later.",
    fanHeld: "governor paused",
    fanOverride: "Override",
    fanOverrideOn:
      "The governor is paused. This fan will hold the step set here until Override is switched off or the board reboots.",
    fanOverrideCeiling:
      "If the board passes {{celsius}} °C the daemon hands the fan back on its own.",
    ariaFanOverride: "Pause the governor for fan {{device}}",
    fanReverted:
      "The board reset {{device}} to {{cur}} of {{max}} after it was set to {{requested}}.",
    ariaFanStep: "Fan {{device}} cooling step",
    boardHealth: "Board Health",
    boardInfo: "Board info",
    boardIp: "IP address",
    healthUptime: "Uptime",
    healthLoad: "Load",
    healthMemory: "Memory",
    healthMemoryDetail: "free {{free}} · available {{available}}",
    healthTemperatureTerm: "Temperature",
    healthTemperature: "{{celsius}} °C",
    healthFanStep: "fan step {{step}} of {{max}}",
    healthFanTrip: "above the {{celsius}} °C trip",
    healthNand: "NAND",
    healthNandFree: "{{available}} of {{total}} eraseblocks free",
    healthNandFreeBytes: "{{size}} free",
    healthNandBad: "{{blocks}} bad",
    healthNandReserved: "{{blocks}} reserved",
    healthNandNote:
      "Eraseblocks are counted as UBI reports them. A low free count is not coloured, because nothing here knows how much headroom this volume needs — but it is the number that runs out on a board reflashed as often as this one, and a bad eraseblock never comes back.",
    healthClock: "Clock",
    healthClockSynced: "synchronised",
    healthClockNotSynced: "not synchronised",
    healthClockUnknown: "sync state unknown",
    healthClockSource: "source {{source}}",
    healthClockStratum: "stratum {{stratum}}",
    healthClockOffsetSeconds: "offset {{value}} s",
    healthClockOffsetMillis: "offset {{value}} ms",
    healthClockOffsetMicros: "offset {{value}} µs",
    healthClockMeasuredBy: "measured by {{tool}}",
    healthAbsent: "not detected",
    healthUnavailable: "This BMC daemon does not report board health.",
    ariaMemoryUtilization: "Memory utilization",
    fanDuty: "{{value}} % duty",
    fanAboveTrip: "above {{celsius}} °C",
    fanDutyNote:
      "Duty is the PWM level the board's own cooling-levels table maps this step to, as the daemon reports that table. The step is the honest reading; the duty is what it commands. A board that reports no table shows the step alone.",
  },
  network: {
    header: "Network",
    networkInterfaces: "Network Interfaces",
    interface: "Interface",
    ipAddress: "IP address",
    macAddress: "MAC address",
    switchHeader: "Switch configuration",
    resetNetworkButton: "Reset Network",
    resetSwitchButton: "Reset the switch chip",
    resetSwitchConfirm:
      "This resets the on-board switch chip, not the BMC's address. Every port drops for a moment: the compute modules lose their link for a few seconds, and so may the BMC.",
    resetNetworkConfirm:
      "This drops the board's network configuration and re-applies the defaults. If you are reaching the board over that network, you will lose this session and may need physical access to get it back.",
    resetNetworkSuccess: "Network reset successful.",
    switchPorts: "Switch Ports",
    switchNodePorts: "Node ports",
    switchUplinkPorts: "Uplink ports",
    switchOtherPorts: "Other ports",
    switchPortUp: "up",
    switchPortDown: "down",
    switchPortAbsent: "not detected",
    switchPortSpeed: "{{speed}} Mb/s",
    switchPortDuplexFull: "full duplex",
    switchPortDuplexHalf: "half duplex",
    switchPortTraffic: "rx {{rx}} · tx {{tx}}",
    switchPortErrors: "errors: {{rx}} rx / {{tx}} tx",
    switchNotProbed: "Switch ports not detected",
    switchNotProbedDescription:
      "The BMC's switch driver did not probe the ports marked below. A compute module behind an unprobed node port has no network at all, while the BMC itself stays reachable, so nothing else on this page will look wrong.",
    switchNoPorts:
      "The BMC reported no switch ports at all. The switch driver is not running, which cuts every compute module off from the network while the BMC itself stays reachable.",
    switchPortsUnavailable:
      "This BMC daemon does not report switch port status.",
  },
  nodes: {
    powerOnTimeTerm: "Power-on time",
    statusSummary: "Node status",
    totalNodes: "Total nodes",
    online: "Online",
    offline: "Offline",
    flashNode: "Flash\u2026",
    usbRouteLabel: "USB route for node {{nodeId}}",
    usbNotRouted: "not routed here",
    usbHeldBy: "the bus is on node {{nodeId}}",
    usbRouted: "the USB bus is now on node {{nodeId}}",
    header: "Power Control",
    restartButton: "Restart",
    openConsole: "Open console",
    moreActions: "More actions",
    editButton: "Edit",
    saveButton: "Save",
    ariaNodePowerToggle: "Toggle node {{nodeId}} power",
    node: "Node {{nodeId}}",
    module: "Module {{moduleId}}",
    nodeName: "Node name",
    moduleName: "Module name",
    powerManagement: "Power Management",
    nodeOn: "Node {{nodeId}} was powered on.",
    nodeOff: "Node {{nodeId}} was powered off.",
    nodeRestarted: "Node {{nodeId}} was restarted.",
    pmError: "Error changing node state.",
    persistSuccess: "Nodes information saved.",
    powerOffConfirmTitle: "Power off Node {{nodeId}}?",
    powerOnConfirmTitle: "Power on Node {{nodeId}}?",
    resetConfirmTitle: "Reset Node {{nodeId}}?",
    powerOffConfirmDescription:
      "This will shut down Node {{nodeId}}. Any running processes will be terminated.",
    powerOnConfirmDescription: "This will start up Node {{nodeId}}.",
    resetConfirmDescription:
      "This will forcefully restart Node {{nodeId}}. Any unsaved data will be lost.",
    dontAskAgain: "Don't ask again for node power operations",
    powerOnFor: "powered on {{duration}} ago",
    powerOff: "powered off",
    powerOnUnreadable: "power-on time not readable",
    linkUp: "link up",
    linkDown: "link down",
    linkAbsent: "switch port not detected",
    linkSpeed: "{{speed}} Mb/s",
    usbBootArmed: "armed for USB boot — will not boot from eMMC",
    usbBootArmedNote:
      "This module's USB-boot pin is held high, so it will stay silent at its next reboot; set its USB route to Device to clear it.",
    powerOnTimeNote:
      "Power-on time is a stamp the BMC writes when it switches a node on, not a probe of the running module, and it is measured against this browser's clock.",
  },
  connection: {
    rebooting:
      "The board is rebooting. This usually takes about {{expected}} seconds; {{elapsed}} so far. The page will come back on its own.",
    rebootingOverdue:
      "The board is still rebooting after {{elapsed}} seconds, which is longer than usual. Still waiting; the page will come back on its own when it answers.",
    lost: "The board stopped answering {{elapsed}} seconds ago, and nothing here asked it to. The page is still trying, and will come back on its own.",
    cameBack: "The board came back in {{seconds}} seconds.",
  },
  addressCard: {
    title: "IP address",
    now: "Now:",
    noAddress: "no IPv4 address",
    via: "via",
    dnsWord: "dns",
    leased: "leased over DHCP",
    fixed: "fixed",
    mode: "Address mode",
    dhcp: "DHCP",
    static: "Static",
    addressLabel: "Address / prefix",
    gatewayLabel: "Gateway",
    dnsLabel: "Resolvers, comma-separated",
    searchLabel: "Search domain",
    incomplete: "Type the address with its prefix, like 192.168.1.20/24.",
    cannotCheck: "The board could not be asked about this address.",
    apply: "Apply",
    tryIt: "Try it",
    windowLabel: "Confirm within",
    windowRange: "s, {{min}}–{{max}}",
    discard: "discard changes",
    tryItNote:
      "Try it puts the address on the board and takes it back by itself unless you confirm — from this page, reloaded at the new address.",
    unchanged:
      "This is what the board is running: {{address}}. Change it to propose something else.",
    applyWarning:
      "This changes the address you are reaching the board at. This page will stop answering here. Open it at the new address and confirm within {{seconds}} seconds, or the board puts the old address back by itself.",
    applied: "Applied, and not yet kept",
    appliedNote:
      "Open this page at the new address and confirm before the window runs out, or it goes back.",
    applyFailed: "The address was not applied",
    applyFailedRevert:
      "The last change could not be applied, and the previous address was put back at once.",
    pendingTitle: "{{address}} is waiting to be confirmed",
    pendingNoClock: "The window is running.",
    countdown: "{{seconds}} seconds left to confirm.",
    tryingNow: "You tried it. Nothing is kept until you confirm.",
    confirm: "Keep it",
    confirmed: "Kept. A reboot now comes back to this.",
    confirmFailed: "The address was not kept",
    revertNow: "Put the old one back now",
    confirmFromThere:
      "A confirmation counts only when it arrives at the new address — this page, reached there. From a shell on the board it proves nothing and is refused.",
    wasReverted:
      "The change at {{at}} was put back because it was not confirmed.",
    fileUnreadable:
      "The board's interfaces file was written by hand and could not be read; a confirmed change replaces it whole.",
    fileHandEdited:
      "The current static address was written by hand; a confirmed change replaces the file.",
  },
  switchConfig: {
    title: "Switch configuration",
    running: "What it is doing now",
    oneNetwork:
      "One network. Every module, the BMC and both uplinks share it, and the switch does not look at VLANs.",
    port: "Port",
    link: "Link",
    traffic: "Traffic",
    showTraffic: "Show traffic",
    hideTraffic: "Hide traffic",
    untagged: "Untagged",
    tagged: "Tagged",
    untaggedOn: "Untagged VLAN on {{port}}",
    taggedOn: "Tagged VLANs on {{port}}",
    none: "none",
    never: "—",
    bmcUntaggedOnly:
      "This board reads untagged frames only, so a tag here would be traffic it cannot see.",
    thisBoard: "this board",
    nothingConfirmed:
      "Nothing has been confirmed, so a reboot comes back to this.",
    change: "Change it",
    startFrom: "Start from",
    discard: "Discard my changes",
    unchanged:
      "This is what the board is running. Change a cell to propose something else.",
    filtering:
      "Look at VLANs (off means one flat network, whatever the table says)",
    spanningTree:
      "Spanning tree, so two uplinks into the same network cannot form a loop",
    names: "Names for these VLANs",
    vlanNumber: "VLAN {{vid}}",
    unnamed: "unnamed",
    notNumbers: "Something in the table is not a VLAN number.",
    cannotCheck:
      "This board cannot check a configuration before it is applied.",
    refusedQuestion:
      "The board refused the question rather than the layout: {{reason}}",
    windowLabel: "Confirm within",
    windowRange: "s, {{min}}–{{max}}",
    tryIt: "Try it",
    tryItNote:
      "Try it applies the change and does not keep it: watch what you reach this board by, then let it go back.",
    triedNote:
      "Watch what you need to watch, then let it go back — or keep it after all.",
    tryingNow:
      "You started this with Try it. Doing nothing is the plan: the board will put the previous configuration back.",
    confirmFromHere:
      "Confirm from the browser or machine you reach this board with — that is the proof. A confirmation sent from a shell on the board itself proves nothing, and the board refuses it.",
    showTable: "Show the table",
    hideTable: "Hide the table",
    trunkNote:
      "These two numbers are yours: your router has to use the same ones, and only you know what is free there.",
    managementVid: "VLAN for this board",
    nodeVid: "VLAN for the modules",
    redundant:
      "Second uplink carries the same VLANs, with spanning tree deciding which one forwards",
    trunkNumbers:
      "Both numbers must be between {{min}} and {{max}}, and they must differ.",
    apply: "Apply",
    applyWarning:
      "This changes the switch you are connected through. The change is applied but NOT kept: if this page cannot reach the board within about {{seconds}} seconds, the board puts the previous configuration back by itself. If that happens, nothing is broken — reload and try again.",
    applied: "Applied, and not yet kept.",
    appliedNote: "Confirm it before the window runs out, or it goes back.",
    applyFailed: "The configuration was not applied",
    pendingTitle: "A change is waiting to be confirmed",
    waitingForUplink:
      "The countdown has not started: the uplink is not forwarding yet. Spanning tree holds a port for its own delay before it passes traffic.",
    countdown: "{{seconds}} seconds left to confirm.",
    confirm: "Keep it",
    confirmed: "Kept. A reboot now comes back to this.",
    confirmFailed: "The change was not kept",
    revertNow: "Put the old one back now",
    wasReverted:
      "Your change at {{at}} was put back because it was not confirmed in time.",
    oneAtATime: "Confirm or revert the waiting change before applying another.",
  },
  console: {
    inputTerm: "Typing here",
    header: "Serial console for a compute module",
    nodeSelect: "Module",
    readerTask: "Reader task",
    readerRunning: "running",
    readerInitialized: "not started",
    readerStopped: "stopped",
    readerUnknown: "not reported",
    readerUnavailable: "This BMC daemon does not report serial reader status.",
    readerNote:
      "This is the state of the daemon's own UART reader, not the module's. A module that is powered off, or booted and silent, has a reader in the same state as one that is mid-boot.",
    stateConnecting: "connecting",
    stateOpen: "connected",
    stateClosed: "closed",
    stateFailed: "not connected",
    negotiated: "as {{protocol}}",
    closeCode: "close code {{code}}",
    closeCodeReason: "close code {{code}}: {{reason}}",
    reconnectButton: "Reconnect",
    clearButton: "Clear",
    redrawButton: "Redraw",
    noSession:
      "There is no session token to authenticate the console with. Log out and back in.",
    failed: {
      certificate:
        "Your browser does not trust this board's certificate. The rest of this page works because you accepted the warning, and that acceptance does not extend to a WebSocket \u2014 which is what the console is. Two fixes: trust the board's certificate authority in your browser, or reach the board through the fleet, where TLS ends on a certificate your browser already trusts.",
      session:
        "The board refused this session. Sign in again; the console was refused for the same reason as everything else on this page.",
      daemon:
        "This board's daemon is too old to serve the console. Update the firmware and the console will work; nothing about your certificate or your session is wrong.",
      unreachable:
        "The board did not answer at all, so the console is not the problem. It may be rebooting, or off the network.",
    },
    failedHint:
      "A browser does not say why a WebSocket handshake failed, so all of these arrive here as a close with no reason. If the rest of this page works, the usual cause is the board's certificate: a browser will not open a WebSocket to a certificate it does not trust, and accepting the warning on the page does NOT extend to this connection. Trust the board's authority, or reach it through the fleet, where TLS ends on a certificate your browser already trusts. The other two causes are a rejected session token and a daemon too old to serve this endpoint.",
    inputNote:
      "Click the terminal to type into it. Keystrokes go to the module exactly as typed, with nothing appended — Ctrl-C, tab completion and the arrow keys included.",
    ariaTerminal: "Serial console for node {{nodeId}}",
    restTitle: "The line-oriented alternative",
    restIntro:
      "The same UART is reachable over plain HTTP, without a WebSocket:",
    restRead: "returns the node's whole 16 KiB buffer.",
    restWrite: "writes one line.",
    restCrlf:
      "The writer always appends CRLF, so it cannot send a bare control character: no Ctrl-C, no tab completion, no arrow keys. It is the right tool from a shell script and the wrong one at a boot prompt.",
  },
  usb: {
    header: "USB route",
    modeSelect: "USB mode",
    nodeSelect: "Connected node",
    submitButton: "Change",
    changeSuccessTitle: "USB mode changed",
    changeSuccessMessage: "USB mode changed successfully.",
    changeFailedTitle: "USB mode change failed",
    mode: {
      definitionsTitle: "USB mode definitions",
      usageWord: "Usage",
      host: "Host",
      hostDefinition: "Turns the USB_OTG port power on.",
      hostUsage:
        "Use when you want to connect USB devices (like keyboard, mouse, USB drive, etc) through the USB_OTG port to supported modules.",
      device: "Device",
      deviceDefinition: "The default mode. Turns the USB_OTG power off.",
      deviceUsage: "Use in any other case.",
      flash: "Flash",
      flashDefinition:
        "Turns the module into flashing mode and sets the USB_OTG into device mode.",
      flashUsage: "Use to flash the module using USB_OTG port.",
      usbNode1: "Node 1 USB-A compatibility mode",
      usbNode1Definition:
        "By selecting this option the primary USB interface of Node 1 gets routed to the USB-A port. Some modules don't have a secondary interface, such as Raspberry Pi CM4's and will therefore not work.",
      usbNode1Usage:
        "Use this option if USB devices are not detected when plugging in.",
    },
  },
  firmwareUpgrade: {
    firmwareSlots: "Firmware Slots",
    slotRunning: "Running",
    slotRollback: "Rollback",
    slotVolumeId: "id {{id}}",
    slotVersionUnreadable: "version not readable",
    slotMissing: "not reported",
    slotNextboot: "Next boot",
    slotStaged: "Update staged",
    slotStagedYes: "yes",
    slotStagedNo: "no",
    slotStagedUnknown: "could not be read",
    slotStagedTitle: "An update is staged",
    slotStagedDescription:
      "The next reboot will start the other slot. Until then the board keeps running the firmware listed below.",
    slotStagedDescriptionNamed:
      "The next reboot will start {{version}}. Until then the board keeps running the firmware listed below.",
    slotStagedVersion: "Staged version",
    slotStagedUnnamed: "recorded without a name",
    availableTitle: "Available firmware",
    checkNow: "Check now",
    checkedAt: "checked {{at}}",
    checking: "checking the sources now",
    releaseNotes: "Notes",
    parkButton: "Upload to the SD card",
    parkModalTitle: "Upload this image to the card?",
    parkModalDescription:
      "The image is written to the SD card and nothing else happens: no reboot, and nothing staged. It then appears in the list above, where you can install it like any other version.",
    rebootToApply: "Reboot to apply",
    rebootToApplyConfirm:
      "The BMC restarts and boots the staged image. The compute modules keep running throughout. If the new image does not come up healthy the board reboots back onto the one it has now.",
    runningIs: "running {{version}}",
    availableError: "The available firmware could not be read from this board.",
    sourceUnreadable: "This source returned nothing usable: {{reason}}",
    sourceEmpty: "This source offers nothing.",
    showAll: "Show all {{count}}",
    showFewer: "show fewer",
    install: "Install",
    installLocalHint: "Install a local image with the upload form below.",
    installFailed: "The install was refused. Nothing has been staged.",
    installStaged:
      "Staged. Reboot when you are ready; the board checks the image before keeping it.",
    installing: "Installing\u2026",
    installingNow:
      "Installing {{version}}: the board downloads the image, checks its sum and writes it to the spare slot. About {{expected}} s; {{elapsed}} s so far. Nothing is armed until it says staged.",
    installingOverdue:
      "Still installing {{version}} after {{elapsed}} s. A slow link takes longer; the board says when it is done, and nothing is armed until then.",
    relationCurrent: "running now",
    relationNewer: "newer",
    relationOlder: "older",
    relationUnknown: "cannot be compared",
    prerelease: "pre-release",
    trustVerified: "checksum verified",
    trustTls: "no checksum published \u2014 TLS only",
    trustUnverified: "unverified",
    confirmTitle: "Install {{version}}?",
    confirmUpgrade:
      "It is written to the spare slot and taken on the next reboot. Nothing changes until you reboot.",
    confirmDowngrade:
      "This is OLDER than what is running. Installing it goes backwards.",
    confirmUnknown:
      "This cannot be compared with the running version, so it may be older.",
    confirmUnverified:
      "This image has no publisher checksum to verify it against.",
    sourcesTitle: "Firmware sources",
    sourcesSave: "Save sources",
    sourcesDescription:
      "Where this board looks for firmware. Stored on the overlay, so the list survives an upgrade.",
    sourcesRejected:
      "The sources were refused. Check the location format for each kind.",
    sourceLabel: "Name",
    sourceKind: "Kind",
    sourceLocation: "Location",
    sourceEnabled: "enabled",
    sourceAdd: "Add a source",
    sourceRemove: "Remove this source",
    sourceHelpGithub:
      "owner/repo. Releases are listed from GitHub and checked against the publisher's SHA256SUMS.",
    sourceHelpHttp:
      "The DIRECTORY holding version folders \u2014 <prefix>/<version>/<image>.tpu \u2014 not a link to an image. Checksums are used when the publisher ships them; some publish none.",
    sourceHelpLocal:
      "An absolute path scanned for .tpu files. Uploads land here. The filename supplies the version.",
    updateStable: "Stable channel",
    updateEdge: "Edge channel",
    updateCheck: "Update check",
    updateAvailable: "an update is available",
    updateCurrent: "this board is current",
    updateUnavailable:
      "could not be checked — the board may have no route to GitHub",
    slotPromotion: "Last promotion",
    slotsUnavailable: "This BMC daemon does not report firmware slots.",
    slotsAbsent:
      "This board does not report an A/B firmware layout, so there is no second slot and nothing to roll back to.",
    slotRollbackNote:
      "The rollback volume is not mounted, so its version cannot be read from a running system. The volume and its size are everything the board reports about it.",
    slotPromotionNote:
      "Promotion is the verdict the board's own health gate reached the last time it booted. A board that failed its checks and put itself back on the previous firmware says so here and nowhere else.",
    header: "Upgrade BMC firmware",
    fileInput: ".tpu file (remote or local):",
    shaInput: "SHA-256 (optional):",
    submitButton: "Upgrade",
    ariaProgress: "Firmware upgrade progress",
    flashModalTitle: "Upgrade Firmware?",
    flashModalDescription:
      "A reboot is required to finalise the upgrade process.",
    uploading: "Uploading BMC firmware...",
    writing: "Writing firmware to BMC...",
    success: "Image parked on the SD card",
    successMessage:
      "It is now listed under SD card in the version list below, where you can install it.",
    uploadFailed: "Failed to upload the BMC firmware",
    writtenData: "{{written}} written",
    error: "An error has occurred",
  },
  sdCard: {
    pickerTitle: "Choose an image from the SD card",
    pickerNote:
      "What is on the board's own card. Whether a file can be written to a module is the daemon's answer, not a guess from its name.",
    usage: "{{free}} free of {{total}} on the card.",
    loading: "Reading the card\u2026",
    unavailable:
      "This daemon cannot list the card. Listing arrived in bmcd 2.34.0; upgrade the firmware to use this.",
    empty: "Nothing on the card.",
    noneFlashable:
      "Nothing on the card can be written to a module. Show everything to see why.",
    colName: "Path on the card",
    colSize: "Size",
    colState: "Can be flashed",
    flashable: "yes",
    notFlashable: "no",
    choose: "Choose",
    showAll: "Show everything",
    showFlashable: "Show only what can be flashed ({{count}})",
    browse: "Choose from the SD card\u2026",
    chosen: "From the SD card: {{path}}",
    clear: "Clear",
  },
  flashNode: {
    header: "Install an OS image on a selected node",
    nodeSelect: "Selected node:",
    fileInput: "File (remote or local):",
    shaInput: "SHA-256 (optional):",
    skipCrc: "Skip CRC",
    submitButton: "Install OS",
    ariaProgress: "Flashing progress",
    flashModalTitle: "Install OS Image",
    flashModalDescription:
      "You are about to overwrite a new image to the selected node.",
    uploading: "Transferring image to node {{nodeId}}...",
    flashing: "Flashing image to node {{nodeId}}...",
    flashingCrc: "Checking CRC and flashing image to node {{nodeId}}...",
    transferFailed: "Failed to transfer the image to node {{nodeId}}",
    success: "Flashing successful",
    successMessage: "Image flashed successfully to the node",
  },
  settings: {
    hostnameTitle: "Hostname",
    hostnameNote:
      "Letters, digits, and hyphens only; no dots. Used as the hostname, mDNS name, and metrics instance label.",
    hostnameNextBoot: "after the next reboot: {{name}}",
    hostnameConfirmTitle: "Rename this board?",
    hostnameConfirm:
      "Renaming to {{name}} changes the instance label on every metrics series, so a Prometheus history will not follow this board across the rename. Renaming back does not undo it.",
    hostnameRenamed: "renamed to {{name}}",
    timeTitle: "Time",
    timeNote:
      "Comma-separated, in preference order; the first is preferred. Leave empty for the pool the firmware ships with.",
    timePlaceholder: "192.168.1.1, pool.ntp.org",
    timeNotConfigurable:
      "This firmware cannot take a server list: its chrony configuration has no sourcedir. Upgrade the firmware first.",
    timeSynchronised: "synchronised",
    timeNotSynchronised: "NOT synchronised",
    timeUnknown: "the clock's state could not be read",
    timeStratum: "stratum {{stratum}}",
    timeOffset: "offset {{ms}} ms",
    timeSaved: "time servers saved",
    timeCleared: "cleared; back to the pool this firmware ships with",
    timeSources: "What chrony thinks of each source",
    timeSourceState: {
      selected: "selected",
      combined: "combined in",
      excluded: "excluded",
      unreachable: "unreachable",
      falseticker: "refused: reports itself unsynchronised",
      too_variable: "too variable",
      unresolved: "unresolved: the board could not look this name up",
      unknown: "unknown",
    },
    timeSourceReach: "{{reach}} of the last 8 polls answered",
    timeSourceStratum: "stratum {{stratum}}",
    timeSourceOffset: "offset {{ms}} ms",
    timeSourceConfigured: "yours",
    timeNoSourceSelected:
      "No source is selected. “unresolved” means the board could not look the name up — it has no working resolver; give it one on the Network tab, or use the server's address instead of its name. “unreachable” means it never answered — check the address, a firewall, or whether that device serves NTP at all. “refused” is a server that reports itself unsynchronised (stratum 16), which chrony will not take time from.",
    configTitle: "Backup and restore",
    configExport: "Back up",
    configImport: "Restore…",
    configWithSecrets: "include the metrics token",
    configSecretsWarning:
      "The backup will contain the metrics token. Anything holding it can scrape any board the file is applied to.",
    configNote: "hostname, time servers, firmware sources and node names",
    configUnreadable: "that file could not be read",
    configImportConfirmTitle: "Apply these settings?",
    configImportConfirm:
      "Each setting is applied on its own and reported separately. There is no undo, and a partial apply leaves the board part-configured rather than unchanged.",
    configApplied: "applied",
    configSkipped: "skipped",
    configFailed: "FAILED",
    rebootModalDescription:
      "The BMC restarts. The compute modules keep running throughout — only this interface, the API and the consoles go away, for about half a minute.",
    rebootStaged: "A firmware update is staged. This reboot will start it.",
    rebootStagedNamed:
      "A firmware update is staged: this reboot will start {{version}}.",
    rebootNote:
      "Rebooting the BMC does not cut power to the compute modules; they keep running throughout.",
  },
  about: {
    boardModel: "Board model",
    boardSerial: "Board serial",
    hostname: "Hostname",
    firmware: "firmware",
    firmwareVersion: "Firmware version",
    daemonVersion: "Daemon version",
    unavailable: "version unavailable",
    buildTime: "Build time",
    buildVersion: "Build version",
    buildrootRelease: "Buildroot release",
    kernel: "Linux kernel",
    apiVersion: "API version",
    bmcUI: "BMC UI",
  },
  ui: {
    aboutThis: "About {{subject}}",
    readMore: "Read more",
    save: "Save",
    cancel: "Cancel",
    continue: "Continue",
    reboot: "Reboot",
    selectPlaceholder: "Select...",
    navigation: "Navigation",
    pageNotFound: "Page Not Found",
    backToHome: "Back to home",
    ariaPasswordVisibility: "Toggle password visibility",
    ariaUploadFile: "Upload file",
    ariaSliderThumb: "Slider thumb",
    durationDays: "{{value}} d",
    durationHours: "{{value}} h",
    durationMinutes: "{{value}} m",
    durationSeconds: "{{value}} s",
  },
};

export default translations;

export type Translations = typeof translations;

/**
 * This type is used to define optional translations for a component.
 * If a key is not present, the default English translation will be used.
 */
export type OptionalTranslations = {
  [Key in keyof Translations]?: Translations[Key];
};
