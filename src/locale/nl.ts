import { type OptionalTranslations } from "@/locale/en";

const translations = {
  navigation: {
    overview: "Overzicht",
    firmware: "Firmware",
    settings: "Instellingen",
    info: "Info",
    network: "Netwerk",
    access: "Toegang",
    nodes: "Nodes",
    console: "Console",
    usb: "USB",
    firmwareUpgrade: "Firmware-upgrade",
    flashNode: "Flash-node",
    about: "Over",
  },
  userNav: {
    language: "Taal",
    theme: "Thema",
    themeSystem: "Systeem",
    themeLight: "Licht",
    themeDark: "Donker",
    logout: "Uitloggen",
  },
  login: {
    header: "Inloggen",
    username: "Gebruikersnaam",
    password: "Wachtwoord",
    remember: "Onthoud mij",
    submit: "Inloggen",
    errorCredentials: "Ongeldige gebruikersnaam of wachtwoord",
    errorUnknown: "Er is een fout opgetreden. Probeer het later opnieuw.",
  },
  // factoryPassword: English here too, and for the same reason as
  // `access` above. This is the page that tells somebody their board is
  // open to anyone who can reach it; a guessed translation of that is
  // worse than a sentence they can look up.
  // access: deliberately English until someone who speaks this language
  // reviews it. These strings decide who can log in to hardware, and a
  // guessed translation of "stop trusting any proxy" is worse than a
  // sentence the reader can look up.
  info: {
    fanAboveTrip: "boven {{celsius}} °C",
    userStorage: "Gebruikersopslag",
    ariaStorageUtilization: "Opslaggebruik",
    backupButton: "Back-up gebruikersgegevens",
    fanControl: "Ventilatorregeling",
    bmc: "BMC",
    rebootButton: "Herstarten",
    reloadDaemonButton: "Daemon herladen",
    rebootModalTitle: "Wilt u opnieuw opstarten?",
    backupSuccess: "Back-upbestand succesvol gedownload.",
    backupFailed: "Back-up van gebruikersgegevens mislukt.",
    rebootSuccess: "De BMC wordt opnieuw opgestart...",
    rebootFailed: "BMC opnieuw opstarten mislukt",
    reloadDaemonSuccess: "De BMC-daemon wordt opnieuw geladen...",
    reloadDaemonFailed: "BMC-daemon herladen mislukt",
    thermalCelsius: "{{value}} °C",
    thermalAbsent: "niet gedetecteerd",
    thermalUnavailable: "Deze BMC-daemon rapporteert geen boardtemperatuur.",
    thermalNoSensors:
      "Dit board rapporteert geen temperatuursensor, dus er is geen temperatuur te lezen. De ventilator draait op de laatst ingestelde waarde, zonder dat er iets geregeld wordt.",
    fanAutomatic: "automatisch",
    fanStep: "{{cur}} van {{max}}",
    fanRequested: "ingesteld {{value}}",
    fanGovernorNote:
      "De kernel regelt deze ventilator op basis van de boardtemperatuur. Deze daemon kan hem niet pauzeren, dus een instelling hier wordt bij de volgende peiling van de regelaar, enkele seconden later, ongedaan gemaakt.",
    fanHeld: "regelaar gepauzeerd",
    fanOverride: "Overschrijven",
    fanOverrideOn:
      "De regelaar is gepauzeerd. Deze ventilator houdt de hier ingestelde stand vast tot Overschrijven wordt uitgeschakeld of het board opnieuw opstart.",
    fanOverrideCeiling:
      "Komt het board boven {{celsius}} °C, dan geeft de daemon de ventilator uit zichzelf terug.",
    ariaFanOverride: "Regelaar voor ventilator {{device}} pauzeren",
    fanReverted:
      "Het board heeft {{device}} teruggezet naar {{cur}} van {{max}} nadat het op {{requested}} was gezet.",
    ariaFanStep: "Koelstand van ventilator {{device}}",
    boardHealth: "Boardconditie",
    healthUptime: "Bedrijfstijd",
    healthLoad: "Belasting",
    healthLoadWindows: "1 / 5 / 15 min",
    healthMemory: "Geheugen",
    healthMemoryDetail: "vrij {{free}} · beschikbaar {{available}}",
    healthTemperatureTerm: "Temperatuur",
    healthTemperature: "{{celsius}} °C",
    healthFanStep: "ventilatorstand {{step}} van {{max}}",
    healthFanTrip: "boven de drempel van {{celsius}} °C",
    healthNand: "NAND",
    healthNandFree: "{{available}} van {{total}} wisblokken vrij",
    healthNandBad: "{{blocks}} defect",
    healthNandReserved: "{{blocks}} gereserveerd",
    healthNandNote:
      "Wisblokken worden geteld zoals UBI ze meldt. Een laag aantal vrije blokken krijgt geen kleur, omdat hier niets weet hoeveel marge dit volume nodig heeft — maar het is het getal dat opraakt op een board dat zo vaak opnieuw geflasht wordt, en een defect wisblok komt nooit terug.",
    healthClock: "Klok",
    healthClockSynced: "gesynchroniseerd",
    healthClockNotSynced: "niet gesynchroniseerd",
    healthClockUnknown: "synchronisatiestatus onbekend",
    healthClockSource: "bron {{source}}",
    healthClockStratum: "stratum {{stratum}}",
    healthClockOffsetSeconds: "afwijking {{value}} s",
    healthClockOffsetMillis: "afwijking {{value}} ms",
    healthClockOffsetMicros: "afwijking {{value}} µs",
    healthClockMeasuredBy: "gemeten met {{tool}}",
    healthAbsent: "niet gedetecteerd",
    healthUnavailable: "Deze BMC-daemon meldt geen boardconditie.",
    ariaMemoryUtilization: "Geheugengebruik",
    fanDuty: "{{value}} % duty",
    fanDutyNote:
      "De duty cycle is de PWM-waarde die de eigen cooling-levels-tabel van het board aan deze stap koppelt, zoals de daemon die tabel meldt. De stap is de eerlijke aflezing; de duty is wat hij aanstuurt. Een board dat geen tabel meldt, toont alleen de stap.",
  },
  network: {
    resetNetworkConfirm:
      "Dit verwijdert de netwerkconfiguratie van het board en zet de standaardwaarden terug. Bereikt u het board via dat netwerk, dan verliest u deze sessie en heeft u mogelijk fysieke toegang nodig.",
    header: "De adressen van de BMC en de ingebouwde switch",
    networkInterfaces: "Netwerkinterfaces",
    resetNetworkButton: "Netwerk resetten",
    resetNetworkSuccess: "Netwerk succesvol gereset.",
    switchPorts: "Switchpoorten",
    switchNodePorts: "Nodepoorten",
    switchUplinkPorts: "Uplinkpoorten",
    switchOtherPorts: "Overige poorten",
    switchPortUp: "verbonden",
    switchPortDown: "niet verbonden",
    switchPortAbsent: "niet gedetecteerd",
    switchPortSpeed: "{{speed}} Mb/s",
    switchPortDuplexFull: "full duplex",
    switchPortDuplexHalf: "half duplex",
    switchPortTraffic: "rx {{rx}} · tx {{tx}}",
    switchPortErrors: "fouten: {{rx}} rx / {{tx}} tx",
    switchNotProbed: "Switchpoorten niet gedetecteerd",
    switchNotProbedDescription:
      "De switchdriver van de BMC heeft de hieronder gemarkeerde poorten niet gedetecteerd. Een computemodule achter een niet-gedetecteerde nodepoort heeft helemaal geen netwerk, terwijl de BMC zelf bereikbaar blijft, zodat niets anders op deze pagina verkeerd lijkt.",
    switchNoPorts:
      "De BMC heeft helemaal geen switchpoorten gerapporteerd. De switchdriver draait niet, waardoor elke computemodule van het netwerk is afgesneden terwijl de BMC zelf bereikbaar blijft.",
    switchPortsUnavailable:
      "Deze BMC-daemon rapporteert geen status van switchpoorten.",
  },
  nodes: {
    powerOnTimeTerm: "Inschakeltijd",
    openConsole: "Console",
    flashNode: "Flashen…",
    usbRouteLabel: "USB-route voor node {{nodeId}}",
    usbNotRouted: "niet hierheen gerouteerd",
    usbHeldBy: "de bus ligt op node {{nodeId}}",
    usbRouted: "de USB-bus ligt nu op node {{nodeId}}",
    header: "Stroomtoevoer van aangesloten nodes regelen",
    restartButton: "Herstarten",
    editButton: "Bewerken",
    saveButton: "Opslaan",
    ariaNodePowerToggle: "Stroomtoevoer van node {{nodeId}} in-/uitschakelen",
    node: "Node {{nodeId}}",
    module: "Module {{moduleId}}",
    nodeName: "Nodenaam",
    moduleName: "Modulenaam",
    powerManagement: "Stroombeheer",
    nodeOn: "Node {{nodeId}} is ingeschakeld.",
    nodeOff: "Node {{nodeId}} is uitgeschakeld.",
    nodeRestarted: "Node {{nodeId}} is opnieuw gestart.",
    pmError: "Fout bij het wijzigen van de nodestatus.",
    persistSuccess: "Node-informatie opgeslagen.",
    powerOffConfirmTitle: "Node {{nodeId}} uitschakelen?",
    powerOnConfirmTitle: "Node {{nodeId}} inschakelen?",
    resetConfirmTitle: "Node {{nodeId}} herstarten?",
    powerOffConfirmDescription:
      "Dit zal Node {{nodeId}} afsluiten. Alle lopende processen worden beëindigd.",
    powerOnConfirmDescription: "Dit zal Node {{nodeId}} opstarten.",
    resetConfirmDescription:
      "Dit zal Node {{nodeId}} geforceerd herstarten. Niet-opgeslagen gegevens gaan verloren.",
    dontAskAgain: "Niet meer vragen voor node-stroomacties",
    powerOnFor: "ingeschakeld {{duration}} geleden",
    powerOff: "uitgeschakeld",
    powerOnUnreadable: "inschakeltijd niet leesbaar",
    linkUp: "verbinding actief",
    linkDown: "geen verbinding",
    linkAbsent: "switchpoort niet gedetecteerd",
    linkSpeed: "{{speed}} Mb/s",
    usbBootArmed: "gereed voor USB-boot — start niet op vanaf eMMC",
    usbBootArmedNote:
      "De USB-bootpin van deze module staat hoog, dus blijft hij bij de volgende herstart stil; zet de USB-route op Apparaat om dit op te heffen.",
    powerOnTimeNote:
      "De inschakeltijd is een tijdstempel die het BMC schrijft wanneer het een node inschakelt, geen meting aan de draaiende module, en hij wordt afgezet tegen de klok van deze browser.",
  },
  connection: {
    rebooting:
      "Het bord start opnieuw op. Dat duurt meestal ongeveer {{expected}} seconden; tot nu toe {{elapsed}}. De pagina komt vanzelf terug.",
    rebootingOverdue:
      "Het bord start na {{elapsed}} seconden nog steeds op, langer dan gebruikelijk. Er wordt doorgewacht; de pagina komt vanzelf terug zodra het antwoordt.",
    lost: "Het bord antwoordt al {{elapsed}} seconden niet meer, en niets hier heeft daarom gevraagd. De pagina blijft het proberen en komt vanzelf terug.",
    cameBack: "Het bord was na {{seconds}} seconden terug.",
  },
  switchConfig: {
    title: "De switch op het bord",
    running: "Wat hij nu doet",
    oneNetwork:
      "Eén netwerk. Alle modules, de BMC en beide uplinks delen het, en de switch kijkt niet naar VLAN's.",
    port: "Poort",
    link: "Verbinding",
    traffic: "Verkeer",
    showTraffic: "Verkeer en fouten tonen",
    hideTraffic: "Verkeer en fouten verbergen",
    untaggedOn: "Untagged VLAN op {{port}}",
    taggedOn: "Tagged VLAN's op {{port}}",
    none: "geen",
    never: "—",
    bmcUntaggedOnly:
      "Dit board leest alleen untagged frames, dus een tag hier zou verkeer zijn dat het niet kan zien.",
    startFrom: "Begin met",
    discard: "Mijn wijzigingen weggooien",
    unchanged:
      "Dit is wat het board draait. Wijzig een cel om iets anders voor te stellen.",
    filtering:
      "Naar VLAN's kijken (uit betekent één plat netwerk, wat de tabel ook zegt)",
    spanningTree:
      "Spanning tree, zodat twee uplinks in hetzelfde netwerk geen lus kunnen vormen",
    names: "Namen voor deze VLAN's",
    vlanNumber: "VLAN {{vid}}",
    unnamed: "naamloos",
    notNumbers: "Iets in de tabel is geen VLAN-nummer.",
    cannotCheck: "Dit board kan een configuratie niet vooraf controleren.",
    tryIt: "Probeer het",
    tryItNote:
      "Probeer het past de wijziging toe en houdt hem niet: kijk waarmee je dit board bereikt en laat hem terugdraaien.",
    triedNote:
      "Kijk wat je moet bekijken en laat het terugdraaien — of houd het alsnog.",
    tryingNow:
      "Je bent hiermee begonnen via Probeer het. Niets doen is het plan: het board zet de vorige configuratie terug.",
    confirmFromHere:
      "Bevestig vanaf de browser of machine waarmee je dit board bereikt — dat is het bewijs. Een bevestiging vanuit een shell op het board zelf bewijst niets, en het board weigert hem.",
    untagged: "Untagged",
    tagged: "Tagged",
    thisBoard: "dit bord",
    nothingConfirmed:
      "Er is niets bevestigd, dus een herstart komt hierop terug.",
    change: "Wijzigen",
    showTable: "Toon de tabel",
    hideTable: "Verberg de tabel",
    trunkNote:
      "Deze twee nummers zijn van u: uw router moet dezelfde gebruiken, en alleen u weet wat daar vrij is.",
    managementVid: "VLAN voor dit bord",
    nodeVid: "VLAN voor de modules",
    redundant:
      "Tweede uplink draagt dezelfde VLAN's; spanning tree bepaalt welke doorstuurt",
    trunkNumbers:
      "Beide nummers moeten tussen {{min}} en {{max}} liggen en van elkaar verschillen.",
    apply: "Toepassen",
    applyWarning:
      "Dit wijzigt de switch waardoor u verbonden bent. De wijziging wordt toegepast maar NIET behouden: kan deze pagina het bord niet binnen ongeveer {{seconds}} seconden bereiken, dan zet het bord de vorige configuratie zelf terug. Er is dan niets stuk — herlaad en probeer opnieuw.",
    applied: "Toegepast, en nog niet behouden.",
    appliedNote:
      "Bevestig voordat het venster verstrijkt, anders gaat het terug.",
    applyFailed: "De configuratie is niet toegepast",
    pendingTitle: "Een wijziging wacht op bevestiging",
    waitingForUplink:
      "Het aftellen is nog niet begonnen: de uplink stuurt nog niet door. Spanning tree houdt een poort eerst zijn eigen vertraging vast.",
    countdown: "Nog {{seconds}} seconden om te bevestigen.",
    confirm: "Behouden",
    confirmed: "Behouden. Een herstart komt nu hierop terug.",
    confirmFailed: "De wijziging is niet behouden",
    revertNow: "Zet de oude nu terug",
    wasReverted:
      "Uw wijziging van {{at}} is teruggezet omdat die niet op tijd is bevestigd.",
    oneAtATime:
      "Bevestig of draai de wachtende wijziging terug voordat u een volgende toepast.",
  },
  console: {
    inputTerm: "Hier typen",
    header: "Seriële console voor een compute-module",
    nodeSelect: "Module",
    readerTask: "Leestaak",
    readerRunning: "actief",
    readerInitialized: "niet gestart",
    readerStopped: "gestopt",
    readerUnknown: "niet gemeld",
    readerUnavailable:
      "Deze BMC-daemon meldt geen status van het seriële lezen.",
    readerNote:
      "Dit is de staat van de UART-leestaak van de daemon zelf, niet die van de module. Een uitgeschakelde module, of een die is opgestart en stil is, heeft een leestaak in dezelfde staat als een module die midden in het opstarten zit.",
    stateConnecting: "verbinden",
    stateOpen: "verbonden",
    stateClosed: "gesloten",
    stateFailed: "niet verbonden",
    negotiated: "als {{protocol}}",
    closeCode: "sluitcode {{code}}",
    closeCodeReason: "sluitcode {{code}}: {{reason}}",
    reconnectButton: "Opnieuw verbinden",
    clearButton: "Wissen",
    redrawButton: "Opnieuw tekenen",
    noSession:
      "Er is geen sessietoken om de console mee te authenticeren. Log uit en weer in.",
    failed: {
      certificate:
        "Uw browser vertrouwt het certificaat van dit bord niet. De rest van deze pagina werkt omdat u de waarschuwing hebt geaccepteerd, en dat geldt niet voor een WebSocket \u2014 en dat is precies wat de console is. Twee oplossingen: vertrouw de certificaatautoriteit van het bord in uw browser, of benader het bord via de vloot, waar TLS eindigt op een certificaat dat uw browser al vertrouwt.",
      session:
        "Het bord heeft deze sessie geweigerd. Meld u opnieuw aan; de console werd om dezelfde reden geweigerd als al het andere op deze pagina.",
      daemon:
        "De daemon van dit bord is te oud voor de console. Werk de firmware bij, dan werkt hij; er is niets mis met uw certificaat of uw sessie.",
      unreachable:
        "Het bord antwoordde helemaal niet, dus de console is niet het probleem. Mogelijk start het opnieuw op of is het niet op het netwerk.",
    },
    failedHint:
      "Een browser zegt niet waarom een WebSocket-handshake mislukte; alle oorzaken komen hier aan als een sluiting zonder reden. Werkt de rest van deze pagina wel, dan is het meestal het certificaat van het bord: een browser opent geen WebSocket naar een certificaat dat hij niet vertrouwt, en de waarschuwing accepteren geldt NIET voor deze verbinding. Vertrouw de certificaatautoriteit van het bord, of gebruik de vloot, waar TLS eindigt op een certificaat dat uw browser al vertrouwt. De andere twee oorzaken zijn een geweigerd sessietoken en een te oude daemon.",
    inputNote:
      "Klik in de terminal om erin te typen. Toetsaanslagen gaan onveranderd naar de module, zonder dat er iets wordt toegevoegd — Ctrl-C, tab-aanvulling en de pijltjestoetsen inbegrepen.",
    ariaTerminal: "Seriële console voor node {{nodeId}}",
    restTitle: "Het regelgerichte alternatief",
    restIntro:
      "Dezelfde UART is bereikbaar over gewone HTTP, zonder WebSocket:",
    restRead: "geeft de volledige buffer van 16 KiB van de node terug.",
    restWrite: "schrijft één regel.",
    restCrlf:
      "De schrijfkant voegt altijd CRLF toe en kan dus geen los stuurteken versturen: geen Ctrl-C, geen tab-aanvulling, geen pijltjestoetsen. Vanuit een shellscript is dat het juiste gereedschap, bij een boot-prompt het verkeerde.",
  },
  usb: {
    header: "USB-route",
    modeSelect: "USB-modus",
    nodeSelect: "Aangesloten node",
    submitButton: "Wijzigen",
    changeSuccessTitle: "USB-modus gewijzigd",
    changeSuccessMessage: "USB-modus succesvol gewijzigd.",
    changeFailedTitle: "Wijzigen van USB-modus mislukt",
    mode: {
      definitionsTitle: "Definities van USB-modi",
      usageWord: "Gebruik",
      host: "Host",
      hostDefinition: "Schakelt de voeding van de USB_OTG-poort in.",
      hostUsage:
        "Gebruik wanneer u USB-apparaten (zoals toetsenbord, muis, USB-station, enz.) via de USB_OTG-poort op ondersteunde modules wilt aansluiten.",
      device: "Apparaat",
      deviceDefinition: "De standaardmodus. Schakelt de USB_OTG-voeding uit.",
      deviceUsage: "Gebruik in alle andere gevallen.",
      flash: "Flash",
      flashDefinition:
        "Zet de module in flashmodus en stelt de USB_OTG in op apparaatmodus.",
      flashUsage: "Gebruik om de module te flashen via de USB_OTG-poort.",
      usbNode1: "Node 1 USB-A compatibiliteitsmodus",
      usbNode1Definition:
        "Door deze optie te selecteren, wordt de primaire USB-interface van Node 1 naar de USB-A-poort geleid. Sommige modules zoals Raspberry Pi CM4 hebben geen secundaire interface en werken daarom niet.",
      usbNode1Usage:
        "Gebruik deze optie als USB-apparaten niet worden gedetecteerd bij het aansluiten.",
    },
  },
  firmwareUpgrade: {
    showAll: "Alle {{count}} tonen",
    showFewer: "minder tonen",
    releaseNotes: "Notities",
    parkButton: "Uploaden naar de SD-kaart",
    parkModalTitle: "Dit image naar de kaart uploaden?",
    parkModalDescription:
      "Het image wordt naar de SD-kaart geschreven en verder niets: geen herstart, niets klaargezet. Het verschijnt daarna in de lijst hierboven en is als elke andere versie te installeren.",
    rebootToApply: "Herstarten om toe te passen",
    rebootToApplyConfirm:
      "De BMC herstart en start het klaargezette image. De compute-modules blijven draaien. Komt het nieuwe image niet gezond op, dan start het board terug op het huidige.",
    firmwareSlots: "Firmwareslots",
    slotRunning: "Actief",
    slotRollback: "Terugval",
    slotVolumeId: "id {{id}}",
    slotVersionUnreadable: "versie niet leesbaar",
    slotMissing: "niet gemeld",
    slotNextboot: "Volgende start",
    slotStaged: "Update klaargezet",
    slotStagedYes: "ja",
    slotStagedNo: "nee",
    slotStagedUnknown: "niet te lezen",
    slotStagedTitle: "Er staat een update klaar",
    slotStagedDescription:
      "De volgende herstart start het andere slot. Tot dan draait het board verder op de firmware hieronder.",
    slotStagedDescriptionNamed:
      "De volgende herstart start {{version}}. Tot dan blijft het board de hieronder vermelde firmware draaien.",
    slotStagedVersion: "Voorbereide versie",
    slotStagedUnnamed: "vastgelegd zonder naam",
    availableTitle: "Available firmware",
    checkNow: "Check now",
    checkedAt: "checked {{at}}",
    checking: "bronnen worden nu gecontroleerd",
    runningIs: "running {{version}}",
    availableError: "The available firmware could not be read from this board.",
    sourceUnreadable: "This source returned nothing usable: {{reason}}",
    sourceEmpty: "This source offers nothing.",
    install: "Install",
    installLocalHint: "Install a local image with the upload form below.",
    installFailed: "The install was refused. Nothing has been staged.",
    installStaged:
      "Staged. Reboot when you are ready; the board checks the image before keeping it.",
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
    updateStable: "Stabiel kanaal",
    updateEdge: "Edge-kanaal",
    updateCheck: "Updatecontrole",
    updateAvailable: "er is een update beschikbaar",
    updateCurrent: "dit board is up-to-date",
    updateUnavailable:
      "kon niet worden gecontroleerd — het board heeft mogelijk geen route naar GitHub",
    slotPromotion: "Laatste promotie",
    slotsUnavailable: "Deze BMC-daemon meldt geen firmwareslots.",
    slotsAbsent:
      "Dit board meldt geen A/B-firmware-indeling, dus er is geen tweede slot en niets om op terug te vallen.",
    slotRollbackNote:
      "Het terugvalvolume is niet aangekoppeld, dus de versie ervan is op een draaiend systeem niet te lezen. Het volume en de grootte zijn alles wat het board erover meldt.",
    slotPromotionNote:
      "De promotie is het oordeel van de eigen startcontrole van het board bij de laatste start. Een board dat zijn controles niet doorstond en zichzelf terugzette op de vorige firmware, meldt dat hier en nergens anders.",
    header: "BMC-firmware upgraden",
    fileInput: ".tpu-bestand (extern of lokaal):",
    shaInput: "SHA-256 (optioneel):",
    submitButton: "Upgraden",
    ariaProgress: "Voortgang firmware-upgrade",
    flashModalTitle: "Firmware upgraden?",
    flashModalDescription:
      "Een herstart is vereist om het upgradeproces te voltooien.",
    uploading: "BMC-firmware uploaden...",
    writing: "Firmware schrijven naar BMC...",
    success: "Image geparkeerd op de SD-kaart",
    successMessage:
      "Hij staat nu onder SD-kaart in de versielijst hieronder, waar je hem kunt installeren.",
    uploadFailed: "Uploaden van BMC-firmware mislukt",
    writtenData: "{{written}} geschreven",
    error: "Er is een fout opgetreden",
  },
  flashNode: {
    header: "Installeer een besturingssysteemimage op een geselecteerde node",
    nodeSelect: "Geselecteerde node:",
    fileInput: "Bestand (extern of lokaal):",
    shaInput: "SHA-256 (optioneel):",
    skipCrc: "CRC overslaan",
    submitButton: "Besturingssysteem installeren",
    ariaProgress: "Voortgang flashen",
    flashModalTitle: "Besturingssysteemimage installeren",
    flashModalDescription:
      "U staat op het punt een nieuw image naar de geselecteerde node te schrijven.",
    uploading: "Image overbrengen naar node {{nodeId}}...",
    flashing: "Image flashen naar node {{nodeId}}...",
    flashingCrc: "CRC controleren en image flashen naar node {{nodeId}}...",
    transferFailed: "Overbrengen van image naar node {{nodeId}} mislukt",
    success: "Flashen geslaagd",
    successMessage: "Image succesvol geflasht naar de node",
  },
  about: {
    boardModel: "Boardmodel",
    boardSerial: "Serienummer board",
    hostname: "Hostnaam",
    firmware: "firmware",
    firmwareVersion: "Firmwareversie",
    daemonVersion: "Daemonversie",
    unavailable: "versie niet beschikbaar",
    buildTime: "Buildtijd",
    buildVersion: "Buildversie",
    buildrootRelease: "Buildroot-release",
    kernel: "Linux-kernel",
    apiVersion: "API-versie",
    bmcUI: "BMC UI",
  },
  ui: {
    aboutThis: "Over {{subject}}",
    readMore: "Meer lezen",
    save: "Opslaan",
    cancel: "Annuleren",
    continue: "Doorgaan",
    reboot: "Herstarten",
    selectPlaceholder: "Selecteer...",
    navigation: "Navigatie",
    pageNotFound: "Pagina niet gevonden",
    backToHome: "Terug naar startpagina",
    ariaPasswordVisibility: "Wachtwoordzichtbaarheid wisselen",
    ariaUploadFile: "Bestand uploaden",
    ariaSliderThumb: "Schuifregelaar",
    durationDays: "{{value}} d",
    durationHours: "{{value}} u",
    durationMinutes: "{{value}} min",
    durationSeconds: "{{value}} s",
  },
} satisfies OptionalTranslations;

export default translations;
