import { type OptionalTranslations } from "@/locale/en";

const translations = {
  navigation: {
    dashboard: "Dashboard",
    firmware: "Firmware",
    network: "Netzwerk",
    switch: "Switch",
    security: "Sicherheit",
    nodes: "Knoten",
    powerControl: "Leistungssteuerung",
    console: "Konsole",
    usb: "USB",
    flashNode: "Knoten flashen",
    // The sidebar's three headings.
    sectionSystem: "System",
    sectionOther: "Andere",
    docs: "Dokumentation",
    github: "GitHub",
    cooling: "Kühlung",
    maintenance: "Wartung",
  },
  userNav: {
    language: "Sprache",
    theme: "Thema",
    themeSystem: "System",
    themeLight: "Hell",
    themeDark: "Dunkel",
    logout: "Abmelden",
  },
  login: {
    header: "Einloggen",
    username: "Benutzername",
    password: "Passwort",
    remember: "Angemeldet bleiben",
    submit: "Einloggen",
    errorCredentials: "Ungültiger Benutzername oder Passwort",
    errorUnknown:
      "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
  },
  // factoryPassword: English here too, and for the same reason as
  // `access` above. This is the page that tells somebody their board is
  // open to anyone who can reach it; a guessed translation of that is
  // worse than a sentence they can look up.
  // access: deliberately English until someone who speaks this language
  // reviews it. These strings decide who can log in to hardware, and a
  // guessed translation of "stop trusting any proxy" is worse than a
  // sentence the reader can look up.
  // The Dashboard (Overview) page.
  dashboard: {
    unnamed: "Kein Name",
    stateOn: "An",
    stateOff: "Aus",
    poweredOnAgo: "Vor {{duration}} eingeschaltet",
    offSinceUnknown: "Aus seit: nicht gemeldet",
    attnUpdate: "Firmware {{version}} ist verfügbar",
  },
  info: {
    fanAboveTrip: "über {{celsius}} °C",
    bmcStorage: "BMC-Speicher",
    ariaStorageUtilization: "Speicherauslastung",
    backupButton: "Benutzerdaten sichern",
    fanControl: "Lüftersteuerung",
    bmc: "BMC",
    rebootButton: "Neustarten",
    reloadDaemonButton: "Daemon neu laden",
    rebootModalTitle: "Möchten Sie neu starten?",
    backupSuccess: "Sicherungsdatei erfolgreich heruntergeladen.",
    backupFailed: "Sicherung der Benutzerdaten fehlgeschlagen.",
    rebootSuccess: "Das BMC wird neu gestartet...",
    rebootFailed: "Neustart des BMC fehlgeschlagen",
    reloadDaemonSuccess: "Der BMC-Daemon wird neu geladen...",
    reloadDaemonFailed: "Neuladen des BMC-Daemons fehlgeschlagen",
    thermalCelsius: "{{value}} °C",
    thermalAbsent: "nicht erkannt",
    thermalUnavailable: "Dieser BMC-Daemon meldet keine Board-Temperatur.",
    thermalNoSensors:
      "Dieses Board meldet keinen Temperatursensor, es gibt also keine Temperatur zu lesen. Der Lüfter läuft mit dem zuletzt gesetzten Wert, ohne dass etwas geregelt wird.",
    fanAutomatic: "automatisch",
    fanStep: "{{cur}} von {{max}}",
    fanStepLabel: "Stufe {{cur}} von {{max}}",
    fanGovernorNote:
      "Der Kernel regelt diesen Lüfter anhand der Board-Temperatur. Dieser Daemon kann ihn nicht anhalten, daher wird eine Einstellung hier bei der nächsten Abfrage des Reglers wenige Sekunden später wieder aufgehoben.",
    fanHeld: "Regler angehalten",
    fanModeAutomatic: "Automatisch",
    fanModeManual: "Manuell",
    fanNotApplied: "Die Lüftereinstellung wurde nicht übernommen",
    fanTrips: "Lüfter schaltet hoch bei",
    tripCritical: "{{celsius}} °C",
    fanOverrideOff:
      "Den Lüfter auf einer gewählten Stufe halten, statt ihn vom Board regeln zu lassen.",
    fanOverrideOn:
      "Der Regler ist angehalten. Dieser Lüfter hält die hier gesetzte Stufe, bis Übersteuern ausgeschaltet wird oder das Board neu startet.",
    fanOverrideCeiling:
      "Übersteigt das Board {{celsius}} °C, gibt der Daemon den Lüfter von sich aus wieder frei.",
    ariaFanOverride: "Regler für Lüfter {{device}} anhalten",
    fanReverted:
      "Das Board hat {{device}} auf {{cur}} von {{max}} zurückgesetzt, nachdem es auf {{requested}} gestellt wurde.",
    ariaFanStep: "Kühlstufe des Lüfters {{device}}",
    boardInfo: "Board-Info",
    boardIp: "IP-Adresse",
    healthUptime: "Laufzeit",
    healthLoad: "Last",
    healthMemory: "Arbeitsspeicher",
    healthTemperatureTerm: "Temperatur",
    healthTemperature: "{{celsius}} °C",
    healthNand: "NAND",
    healthNandFree: "{{available}} von {{total}} Löschblöcken frei",
    healthNandFreeBytes: "{{size}} frei",
    healthNandBad: "{{blocks}} defekt",
    healthClock: "Uhr",
    healthClockSynced: "synchronisiert",
    healthClockNotSynced: "nicht synchronisiert",
    healthClockUnknown: "Synchronisationsstatus unbekannt",
    healthAbsent: "nicht erkannt",
    healthUnavailable: "Dieser BMC-Daemon meldet keinen Board-Zustand.",
    ariaMemoryUtilization: "Speicherauslastung des Arbeitsspeichers",
    fanDuty: "{{value}} % Tastgrad",
    fanDutyNote:
      "Die Leistung ist der Anteil, mit dem der Lüfter läuft, aus der Stufentabelle des Boards. Ein Board ohne Tabelle zeigt stattdessen die Stufe.",
  },
  network: {
    networkInterfaces: "Netzwerkschnittstellen",
    interface: "Schnittstelle",
    ipAddress: "IP-Adresse",
    macAddress: "MAC-Adresse",
    resetSwitchButton: "Switch-Chip zurücksetzen",
    resetSwitchConfirm:
      "Das setzt den integrierten Switch-Chip zurück, nicht die Adresse des BMC. Jeder Port fällt kurz aus: die Rechenmodule verlieren einige Sekunden lang die Verbindung, der BMC womöglich auch.",
    resetNetworkSuccess: "Netzwerk erfolgreich zurückgesetzt.",
    switchPortUp: "verbunden",
    switchPortDown: "getrennt",
    switchPortAbsent: "nicht erkannt",
    switchPortDuplexHalf: "Halbduplex",
    switchPortTraffic: "rx {{rx}} · tx {{tx}}",
    switchNotProbed: "Switch-Ports nicht erkannt",
    switchNotProbedDescription:
      "Der Switch-Treiber des BMC hat die unten markierten Ports nicht erkannt. Ein Compute-Modul hinter einem nicht erkannten Node-Port hat überhaupt kein Netzwerk, während das BMC selbst erreichbar bleibt, sodass nichts anderes auf dieser Seite falsch aussieht.",
    switchNoPorts:
      "Das BMC hat überhaupt keine Switch-Ports gemeldet. Der Switch-Treiber läuft nicht, wodurch jedes Compute-Modul vom Netzwerk getrennt ist, während das BMC selbst erreichbar bleibt.",
    switchPortsUnavailable:
      "Dieser BMC-Daemon meldet keinen Status der Switch-Ports.",
  },
  nodes: {
    powerOnTimeTerm: "Einschaltzeit",
    flashNode: "Flashen…",
    restartButton: "Neu starten",
    openConsole: "Konsole öffnen",
    moreActions: "Weitere Aktionen",
    editButton: "Bearbeiten",
    saveButton: "Speichern",
    ariaNodePowerToggle: "Stromversorgung von Knoten {{nodeId}} umschalten",
    node: "Knoten {{nodeId}}",
    module: "Modul {{moduleId}}",
    nodeName: "Knotenname",
    moduleName: "Modulname",
    powerManagement: "Stromverwaltung",
    nodeOn: "Knoten {{nodeId}} wurde eingeschaltet.",
    nodeOff: "Knoten {{nodeId}} wurde ausgeschaltet.",
    nodeRestarted: "Knoten {{nodeId}} wurde neu gestartet.",
    pmError: "Fehler beim Ändern des Knotenstatus.",
    persistSuccess: "Knoteninformationen gespeichert.",
    powerOffConfirmTitle: "Knoten {{nodeId}} ausschalten?",
    powerOnConfirmTitle: "Knoten {{nodeId}} einschalten?",
    resetConfirmTitle: "Knoten {{nodeId}} zurücksetzen?",
    powerOffConfirmDescription:
      "Dies wird Knoten {{nodeId}} herunterfahren. Alle laufenden Prozesse werden beendet.",
    powerOnConfirmDescription: "Dies wird Knoten {{nodeId}} starten.",
    resetConfirmDescription:
      "Dies wird Knoten {{nodeId}} zwangsweise neu starten. Nicht gespeicherte Daten gehen verloren.",
    dontAskAgain: "Bei Knotenstromoperationen nicht mehr nachfragen",
    powerOnFor: "eingeschaltet vor {{duration}}",
    powerOff: "ausgeschaltet",
    powerOnUnreadable: "Einschaltzeit nicht lesbar",
    linkUp: "Verbindung aktiv",
    linkDown: "keine Verbindung",
    linkAbsent: "Switch-Port nicht erkannt",
    linkSpeed: "{{speed}} Mb/s",
    usbBootArmed: "für USB-Boot scharf geschaltet — bootet nicht von der eMMC",
    usbBootArmedNote:
      "Der USB-Boot-Pin dieses Moduls ist aktiv, daher bleibt es beim nächsten Neustart stumm; setze seine USB-Route auf Gerät, um das aufzuheben.",
    powerOnTimeNote:
      "Die Einschaltzeit ist ein Zeitstempel, den das BMC beim Einschalten eines Knotens schreibt, keine Abfrage des laufenden Moduls, und sie wird gegen die Uhr dieses Browsers gemessen.",
  },
  connection: {
    rebooting:
      "Das Board startet neu. Das dauert normalerweise etwa {{expected}} Sekunden; bisher {{elapsed}}. Die Seite kehrt von selbst zurück.",
    rebootingOverdue:
      "Das Board startet nach {{elapsed}} Sekunden immer noch neu, länger als üblich. Es wird weiter gewartet; die Seite kehrt von selbst zurück, sobald es antwortet.",
    lost: "Das Board antwortet seit {{elapsed}} Sekunden nicht mehr, und nichts hier hat es dazu aufgefordert. Die Seite versucht es weiter und kehrt von selbst zurück.",
    cameBack: "Das Board war nach {{seconds}} Sekunden wieder da.",
  },
  addressCard: {
    title: "IP-Adresse",
    mode: "Adressmodus",
    dhcp: "DHCP",
    static: "Statisch",
    addressLabel: "Adresse / Präfix",
    gatewayLabel: "Gateway",
    dnsLabel: "Resolver, durch Komma getrennt",
    searchLabel: "Suchdomäne",
    incomplete: "Adresse mit Präfix eingeben, z. B. 192.168.1.20/24.",
    cannotCheck: "Das Board konnte zu dieser Adresse nicht befragt werden.",
    apply: "Anwenden",
    tryIt: "Ausprobieren",
    windowLabel: "Bestätigen innerhalb von",
    windowRange: "s, {{min}}–{{max}}",
    discard: "Änderungen verwerfen",
    tryItNote:
      "Ausprobieren setzt die Adresse auf dem Board und nimmt sie von selbst zurück, sofern Sie nicht bestätigen — von dieser Seite, neu geladen unter der neuen Adresse.",
    applyWarning:
      "Das ändert die Adresse, unter der Sie das Board gerade erreichen. Diese Seite antwortet hier dann nicht mehr. Öffnen Sie sie unter der neuen Adresse und bestätigen Sie innerhalb von {{seconds}} Sekunden, sonst stellt das Board die alte Adresse von selbst wieder her.",
    applied: "Angewendet, noch nicht übernommen",
    appliedNote:
      "Öffnen Sie diese Seite unter der neuen Adresse und bestätigen Sie, bevor das Zeitfenster abläuft, sonst geht es zurück.",
    applyFailed: "Die Adresse wurde nicht angewendet",
    applyFailedRevert:
      "Die letzte Änderung konnte nicht angewendet werden; die vorherige Adresse wurde sofort wiederhergestellt.",
    pendingTitle: "{{address}} wartet auf Bestätigung",
    pendingNoClock: "Das Zeitfenster läuft.",
    countdown: "Noch {{seconds}} Sekunden zum Bestätigen.",
    tryingNow:
      "Sie probieren es aus. Nichts wird übernommen, bis Sie bestätigen.",
    confirm: "Behalten",
    confirmed: "Übernommen. Ein Neustart kommt jetzt hierher zurück.",
    confirmFailed: "Die Adresse wurde nicht übernommen",
    revertNow: "Alte Adresse jetzt wiederherstellen",
    confirmFromThere:
      "Eine Bestätigung zählt nur, wenn sie unter der neuen Adresse ankommt — diese Seite, dort geöffnet. Von einer Shell auf dem Board beweist sie nichts und wird abgelehnt.",
    wasReverted:
      "Die Änderung von {{at}} wurde zurückgenommen, weil sie nicht bestätigt wurde.",
    fileUnreadable:
      "Die interfaces-Datei des Boards wurde von Hand geschrieben und konnte nicht gelesen werden; eine bestätigte Änderung ersetzt sie vollständig.",
    fileHandEdited:
      "Die aktuelle statische Adresse wurde von Hand eingetragen; eine bestätigte Änderung ersetzt die Datei.",
  },
  switchConfig: {
    title: "Switch",
    badgeFilteringOn: "VLAN-Filter an",
    badgeFilteringOff: "VLAN-Filter aus",
    badgeStpOn: "STP an",
    badgeStpOff: "STP aus",
    oneNetwork:
      "Alle Ports teilen ein Netzwerk. Die VLAN-Spalten gelten erst mit aktivem Filter.",
    port: "Port",
    link: "Verbindung",
    traffic: "Datenverkehr",
    untaggedOn: "Untagged-VLAN auf {{port}}",
    taggedOn: "Tagged-VLANs auf {{port}}",
    none: "keins",
    never: "—",
    bmcUntaggedOnly:
      "Dieses Board liest nur untagged Frames; ein Tag hier wäre Verkehr, den es nicht sehen kann.",
    startFrom: "Ausgehen von",
    filtering:
      "VLANs beachten (aus heißt ein flaches Netzwerk, was auch immer in der Tabelle steht)",
    spanningTree:
      "Spanning Tree, damit zwei Uplinks in dasselbe Netz keine Schleife bilden können",
    names: "Namen für diese VLANs",
    vlanNumber: "VLAN {{vid}}",
    unnamed: "unbenannt",
    notNumbers: "Etwas in der Tabelle ist keine VLAN-Nummer.",
    cannotCheck: "Dieses Board kann eine Konfiguration nicht vorab prüfen.",
    refusedQuestion:
      "The board refused the question rather than the layout: {{reason}}",
    windowLabel: "Bestätigen in",
    windowRange: "s, {{min}}–{{max}}",
    confirmFromHere:
      "Bestätigen Sie von dem Browser oder Rechner aus, über den Sie dieses Board erreichen — das ist der Beweis. Eine Bestätigung aus einer Shell auf dem Board selbst beweist nichts, und das Board weist sie ab.",
    untagged: "Untagged",
    tagged: "Tagged",
    thisBoard: "dieses Board",
    apply: "Anwenden",
    applyWarning:
      "Dies ändert den Switch, über den Sie verbunden sind. Die Änderung wird angewendet, aber NICHT behalten: Erreicht diese Seite das Board nicht innerhalb von etwa {{seconds}} Sekunden, stellt das Board die vorherige Konfiguration selbst wieder her. Dann ist nichts kaputt — neu laden und erneut versuchen.",
    applied: "Angewendet, aber noch nicht behalten.",
    appliedNote:
      "Bestätigen Sie, bevor das Zeitfenster abläuft, sonst wird zurückgesetzt.",
    applyFailed: "Die Konfiguration wurde nicht angewendet",
    pendingTitle: "Eine Änderung wartet auf Bestätigung",
    waitingForUplink:
      "Der Countdown läuft noch nicht: Der Uplink leitet noch nicht weiter. Spanning Tree hält einen Port erst für seine eigene Verzögerung zurück.",
    countdown: "Noch {{seconds}} Sekunden zum Bestätigen.",
    confirm: "Behalten",
    confirmed: "Behalten. Ein Neustart kehrt jetzt hierher zurück.",
    confirmFailed: "Die Änderung wurde nicht behalten",
    revertNow: "Jetzt zurücksetzen",
    wasReverted:
      "Ihre Änderung um {{at}} wurde zurückgesetzt, weil sie nicht rechtzeitig bestätigt wurde.",
    oneAtATime:
      "Bestätigen oder verwerfen Sie die wartende Änderung, bevor Sie eine weitere anwenden.",
    edit: "Bearbeiten",
    filteringShort: "VLAN-Filterung",
    stpShort: "Spanning Tree (STP)",
    filteringOnNote: "Jeder Port erreicht nur die bei ihm aufgeführten VLANs.",
    presetPlaceholder: "Mit einer Vorlage beginnen…",
  },
  console: {
    inputTerm: "Eingabe hier",
    header: "Serielle Konsole",
    nodeSelect: "Knoten",
    readerTask: "Lese-Task",
    readerRunning: "läuft",
    readerInitialized: "nicht gestartet",
    readerStopped: "gestoppt",
    readerUnknown: "nicht gemeldet",
    readerUnavailable:
      "Dieser BMC-Daemon meldet keinen Status des seriellen Lese-Tasks.",
    readerNote:
      "Dies ist der Zustand des UART-Lese-Tasks im Daemon, nicht der des Moduls. Ein ausgeschaltetes oder ein gebootetes und stilles Modul hat einen Lese-Task im selben Zustand wie ein Modul mitten im Startvorgang.",
    stateConnecting: "verbinde",
    stateOpen: "verbunden",
    stateClosed: "geschlossen",
    stateFailed: "nicht verbunden",
    negotiated: "als {{protocol}}",
    closeCode: "Schließcode {{code}}",
    closeCodeReason: "Schließcode {{code}}: {{reason}}",
    reconnectButton: "Neu verbinden",
    clearButton: "Leeren",
    redrawButton: "Neu zeichnen",
    noSession:
      "Es gibt kein Sitzungstoken, mit dem sich die Konsole authentifizieren könnte. Melden Sie sich ab und wieder an.",
    failed: {
      certificate:
        "Ihr Browser vertraut dem Zertifikat dieses Boards nicht. Der Rest dieser Seite funktioniert, weil Sie die Warnung akzeptiert haben, und das gilt nicht für einen WebSocket \u2014 und genau das ist die Konsole. Zwei Abhilfen: der Zertifizierungsstelle des Boards im Browser vertrauen, oder das Board über die Flotte erreichen, wo TLS auf einem bereits vertrauten Zertifikat endet.",
      session:
        "Das Board hat diese Sitzung abgelehnt. Melden Sie sich erneut an; die Konsole wurde aus demselben Grund abgelehnt wie alles andere auf dieser Seite.",
      daemon:
        "Der Daemon dieses Boards ist zu alt für die Konsole. Aktualisieren Sie die Firmware, dann funktioniert sie; an Ihrem Zertifikat oder Ihrer Sitzung liegt es nicht.",
      unreachable:
        "Das Board hat überhaupt nicht geantwortet, die Konsole ist also nicht das Problem. Möglicherweise startet es neu oder ist nicht im Netz.",
    },
    failedHint:
      "Ein Browser sagt nicht, warum ein WebSocket-Handshake fehlgeschlagen ist; alle Ursachen erscheinen hier als Schließen ohne Grund. Wenn der Rest dieser Seite funktioniert, liegt es meist am Zertifikat des Boards: ein Browser öffnet keinen WebSocket zu einem Zertifikat, dem er nicht vertraut, und das Akzeptieren der Warnung gilt für diese Verbindung NICHT. Vertrauen Sie der Zertifizierungsstelle des Boards, oder nutzen Sie die Flotte, wo TLS auf einem bereits vertrauten Zertifikat endet. Die anderen beiden Ursachen sind ein abgelehntes Sitzungstoken und ein zu alter Daemon.",
    inputNote:
      "Tasten gehen genau wie getippt an das Modul, auch Strg-C, Tab und die Pfeiltasten. Der HTTP-Schreiber unten hängt immer ein Zeilenende an und kann diese daher nicht senden: für Skripte, nicht für einen Boot-Prompt.",
    ariaTerminal: "Serielle Konsole für Knoten {{nodeId}}",
    restTitle: "Die zeilenorientierte Alternative",
    restIntro:
      "Dieselbe UART ist auch über einfaches HTTP erreichbar, ohne WebSocket:",
    restRead: "gibt den gesamten 16-KiB-Puffer des Knotens zurück.",
    restWrite: "schreibt eine Zeile.",
  },
  usb: {
    header: "USB-Route",
    modeSelect: "USB-Modus",
    nodeSelect: "Verbundener Knoten",
    submitButton: "Ändern",
    changeSuccessTitle: "USB-Modus geändert",
    changeSuccessMessage: "USB-Modus erfolgreich geändert.",
    changeFailedTitle: "Ändern des USB-Modus fehlgeschlagen",
    mode: {
      definitionsTitle: "Definitionen des USB-Modus",
      usageWord: "Verwendung",
      host: "Host",
      hostDefinition: "Schaltet die Stromversorgung des USB_OTG-Ports ein.",
      hostUsage:
        "Verwenden Sie diese Option, wenn Sie USB-Geräte (wie Tastatur, Maus, USB-Laufwerk usw.) über den USB_OTG-Port mit unterstützten Modulen verbinden möchten.",
      device: "Gerät",
      deviceDefinition:
        "Der Standardmodus. Schaltet die USB_OTG-Stromversorgung aus.",
      deviceUsage: "In allen anderen Fällen verwenden.",
      flash: "Flash",
      flashDefinition:
        "Versetzt das Modul in den Flash-Modus und setzt den USB_OTG in den Gerätemodus.",
      flashUsage:
        "Verwenden Sie diese Option, um das Modul über den USB_OTG-Port zu flashen.",
      usbNode1: "Node 1 USB-A Kompatibilitätsmodus",
      usbNode1Definition:
        "Durch Auswahl dieser Option wird die primäre USB-Schnittstelle von Node 1 zum USB-A-Anschluss geleitet. Einige Module wie Raspberry Pi CM4 haben keine sekundäre Schnittstelle und funktionieren daher nicht.",
      usbNode1Usage:
        "Verwenden Sie diese Option, wenn USB-Geräte beim Einstecken nicht erkannt werden.",
    },
  },
  firmwareUpgrade: {
    showFewer: "weniger anzeigen",
    releaseNotes: "Hinweise",
    parkButton: "Auf die SD-Karte hochladen",
    parkModalTitle: "Dieses Image auf die Karte laden?",
    parkModalDescription:
      "Das Image wird auf die SD-Karte geschrieben, mehr nicht: kein Neustart, nichts bereitgestellt. Es erscheint dann in der Liste oben und lässt sich wie jede andere Version installieren.",
    rebootToApply: "Zum Anwenden neu starten",
    rebootToApplyConfirm:
      "Der BMC startet neu und bootet das bereitgestellte Image. Die Compute-Module laufen dabei weiter. Kommt das neue Image nicht sauber hoch, bootet das Board zurück auf das jetzige.",
    firmwareSlots: "Firmware-Slots",
    promotionPassed: "Bestanden",
    promotionRolledBack: "Zurückgesetzt",
    promotionUnknown: "Aufgezeichnet",
    statusCurrent: "Aktuell",
    statusUpdate: "Update verfügbar · {{version}}",
    uploadButton: ".tpu hochladen",
    sourcesButton: "Quellen",
    colVersion: "Version",
    colSource: "Quelle",
    colChecksum: "Prüfsumme",
    showAllVersions: "Alle {{count}} Versionen anzeigen",
    slotNothingStaged: "nichts vorgemerkt",
    slotRunning: "Laufend",
    slotRollback: "Rollback",
    slotVolumeId: "id {{id}}",
    slotVersionUnreadable: "Version nicht lesbar",
    slotMissing: "nicht gemeldet",
    slotNextboot: "Nächster Start",
    slotStagedUnknown: "nicht lesbar",
    slotStagedTitle: "Ein Update ist vorgemerkt",
    slotStagedDescription:
      "Der nächste Neustart startet den anderen Slot. Bis dahin läuft auf dem Board weiterhin die unten aufgeführte Firmware.",
    slotStagedDescriptionNamed:
      "Der nächste Neustart startet {{version}}. Bis dahin läuft auf dem Board die unten aufgeführte Firmware.",
    slotStagedUnnamed: "ohne Namen aufgezeichnet",
    availableTitle: "Available firmware",
    checkNow: "Check now",
    checkedAt: "checked {{at}}",
    checking: "Quellen werden jetzt geprüft",
    runningIs: "running {{version}}",
    availableError: "The available firmware could not be read from this board.",
    sourceUnreadable: "This source returned nothing usable: {{reason}}",
    sourceEmpty: "This source offers nothing.",
    install: "Install",
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
    updateStable: "Stabiler Kanal",
    updateEdge: "Edge-Kanal",
    updateUnavailable:
      "konnte nicht geprüft werden — das Board hat möglicherweise keine Route zu GitHub",
    slotPromotion: "Letzte Übernahme",
    slotsUnavailable: "Dieser BMC-Daemon meldet keine Firmware-Slots.",
    slotsAbsent:
      "Dieses Board meldet kein A/B-Firmware-Layout, es gibt also keinen zweiten Slot und nichts, wohin zurückgerollt werden könnte.",
    slotRollbackNote:
      "Das Rollback-Volume ist nicht eingebunden, daher kann seine Version auf einem laufenden System nicht gelesen werden. Das Volume und seine Größe sind alles, was das Board darüber meldet.",
    slotPromotionNote:
      "Die Übernahme ist das Urteil der bordeigenen Startprüfung beim letzten Start. Ein Board, das seine Prüfungen nicht bestanden hat und auf die vorherige Firmware zurückgekehrt ist, sagt das hier und sonst nirgends.",
    fileInput: ".tpu-Datei (Remote oder lokal):",
    shaInput: "SHA-256 (optional):",
    ariaProgress: "Fortschritt der Firmware-Aktualisierung",
    uploading: "BMC-Firmware wird hochgeladen...",
    writing: "Firmware wird auf das BMC geschrieben...",
    success: "Image auf der SD-Karte abgelegt",
    successMessage:
      "Es steht jetzt unter SD-Karte in der Versionsliste unten, wo Sie es installieren können.",
    uploadFailed: "Hochladen der BMC-Firmware fehlgeschlagen",
    writtenData: "{{written}} geschrieben",
    error: "Ein Fehler ist aufgetreten",
  },
  flashNode: {
    header: "Knoten flashen",
    nodeSelect: "Knoten",
    fileInput: "Datei (Remote oder lokal)",
    shaInput: "SHA-256 (optional)",
    skipCrc: "CRC überspringen",
    submitButton: "Betriebssystem installieren",
    ariaProgress: "Fortschritt beim Flashen",
    flashModalTitle: "Betriebssystemabbild installieren",
    flashModalDescription:
      "Sie sind dabei, ein neues Image auf den ausgewählten Knoten zu überschreiben.",
    uploading: "Übertrage Image auf Knoten {{nodeId}}...",
    flashing: "Flashe Image auf Knoten {{nodeId}}...",
    flashingCrc: "Prüfe CRC und flashe Image auf Knoten {{nodeId}}...",
    transferFailed:
      "Übertragung des Images auf Knoten {{nodeId}} fehlgeschlagen",
    success: "Flashen erfolgreich",
    successMessage: "Image erfolgreich auf den Knoten geflasht",
  },
  about: {
    boardModel: "Board-Modell",
    boardSerial: "Board-Seriennummer",
    hostname: "Hostname",
    firmwareVersion: "Firmware-Version",
    daemonVersion: "Daemon-Version",
    unavailable: "Version nicht verfügbar",
    buildTime: "Build-Zeit",
    buildVersion: "Build-Version",
    buildrootRelease: "Buildroot-Release",
    kernel: "Linux-Kernel",
    apiVersion: "API-Version",
    bmcUI: "BMC UI",
    software: "Software",
    ariaCopy: "{{value}} kopieren",
    copied: "Kopiert",
  },
  ui: {
    aboutThis: "Über {{subject}}",
    readMore: "Mehr dazu",
    save: "Speichern",
    cancel: "Abbrechen",
    continue: "Fortfahren",
    reboot: "Neu starten",
    selectPlaceholder: "Auswählen...",
    pageNotFound: "Seite nicht gefunden",
    backToHome: "Zurück zur Startseite",
    ariaPasswordVisibility: "Passwort-Sichtbarkeit umschalten",
    ariaUploadFile: "Datei hochladen",
    durationDays: "{{value}} T",
    durationHours: "{{value}} Std",
    durationMinutes: "{{value}} Min",
    durationSeconds: "{{value}} Sek",
  },
} satisfies OptionalTranslations;

export default translations;
