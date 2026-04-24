// Wi-Fi / 802.11 learning curriculum.

export const CURRICULUM = {
  id: 'wifi',
  title: 'Wi-Fi / 802.11',
  tagline: 'RF, PHY, MAC, security, roaming, RRM, and the Wi-Fi 6E/7 era.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 300,
  modules: [
    {
      id: 'fundamentals',
      title: '802.11 Fundamentals',
      tagline: 'Bands, channels, CSMA/CA, BSS, and the physical layer underneath it all.',
      icon: '📶',
      sections: [
        { kind: 'prose', html: `
          <p><b>Wi-Fi</b> (IEEE 802.11) is a half-duplex, CSMA/CA radio protocol. Stations share a collision domain, listen before transmit, and back off on contention. Unlike Ethernet's CSMA/CD, radio cannot detect a collision while transmitting — so every frame is positively ACKed by the receiver.</p>
          <p>Three licence-exempt bands dominate today:</p>
          <ul>
            <li><b>2.4 GHz</b> — three non-overlapping 20 MHz channels (1, 6, 11). Crowded, longer range, interference from everything (BT, ZigBee, microwaves).</li>
            <li><b>5 GHz</b> — 20+ channels, DFS in the middle block, shorter range, less congested. Standard band for modern enterprise Wi-Fi.</li>
            <li><b>6 GHz</b> — 1200 MHz of fresh spectrum (UK/EU up to 500 MHz, US full 1200 MHz). Wi-Fi 6E and Wi-Fi 7 only. No legacy stations, no DFS, clean channels.</li>
          </ul>` },
        { kind: 'diagram', title: 'BSS / ESS / DS', ascii:
`  +----+                           +----+
  | AP1 |                           | AP2 |
  +----+                           +----+
    |  \\                          /  |
   BSS1  \\                       /  BSS2   (each BSS = one AP and its clients)
    |     \\        DS           /   |
    +------ wired LAN / WLC --------+

  ESS = multiple BSSs with the same SSID sharing a distribution system.
  Seamless roaming happens within an ESS.` },
        { kind: 'callout', level: 'info', title: 'Wi-Fi is half-duplex, full-stop', body: `No matter the PHY, only one station in a BSS can transmit at a time. "AP and clients" all share one collision domain. Doubling the client count at saturation roughly halves each client's share. Wider channels give more raw rate but do not change the sharing. This is why <b>cell density</b> matters more than a single AP's PHY capability.` },
      ],
    },

    {
      id: 'phy',
      title: 'PHY Evolution — Wi-Fi 4 through 7',
      tagline: 'What each amendment actually changed, and which clients still matter.',
      icon: '🚀',
      sections: [
        { kind: 'table', title: '802.11 PHY generations', headers: ['Amendment','Wi-Fi name','Year','Bands','Max channel','Key feature'], rows: [
          ['802.11a','—','1999','5','20 MHz','OFDM @ 5 GHz, up to 54 Mbps'],
          ['802.11b','—','1999','2.4','20 MHz','DSSS @ 11 Mbps — still in every beacon interval'],
          ['802.11g','—','2003','2.4','20 MHz','OFDM @ 2.4, 54 Mbps'],
          ['802.11n','Wi-Fi 4','2009','2.4/5','40 MHz','MIMO, frame aggregation, 600 Mbps'],
          ['802.11ac','Wi-Fi 5','2013','5 only','160 MHz','256-QAM, MU-MIMO (DL), ~7 Gbps'],
          ['802.11ax','Wi-Fi 6 / 6E','2019 / 2021','2.4/5 (6)','160 MHz','OFDMA, 1024-QAM, BSS colouring, TWT'],
          ['802.11be','Wi-Fi 7','2024','2.4/5/6','320 MHz','MLO, 4K-QAM, multi-RU, 46 Gbps'],
        ]},
        { kind: 'callout', level: 'tip', title: 'OFDMA matters more than top speed', body: `Wi-Fi 5 gave one client the whole channel until its frame was done. Wi-Fi 6's <b>OFDMA</b> can schedule multiple small clients into <em>subcarrier groups</em> (RUs) of the same channel simultaneously — so an IoT door sensor and a laptop can transmit in the same airtime slot. For dense, many-client environments (offices, arenas) OFDMA helps more than the bigger PHY rate.` },
      ],
    },

    {
      id: 'association',
      title: 'Association & Authentication',
      tagline: 'What actually happens between Probe and 4-way handshake.',
      icon: '🔌',
      sections: [
        { kind: 'diagram', title: 'Association flow (802.1X)', ascii:
`  Client         AP            Authenticator (WLC)     RADIUS
     |  Probe Req. |                                          |
     |<-Probe Rsp.-|                                          |
     |  Auth Req.  |  (open — deferred to 802.1X)             |
     |<-Auth Rsp.--|                                          |
     |  Assoc Req. |                                          |
     |<-Assoc Rsp.-|                                          |
     |<--- EAPOL-Start --|                                    |
     |<-- EAP-Identity Rq--|                                  |
     | --EAP-Identity---->|  RADIUS Access-Request ---------->|
     |     ...EAP inner method (e.g. PEAP, EAP-TLS)...        |
     |<--EAPOL-Key (4-way handshake, PMK→PTK)-->|             |
     |   normal traffic                                       |` },
        { kind: 'table', title: 'Wi-Fi security modes in use today', headers: ['Mode','Key material','Best for','Notes'], rows: [
          ['Open + Captive Portal','None (MAC-based)','Guest, public hotspots','No encryption — use WPA3-OWE to get air encryption'],
          ['WPA2-Personal (PSK)','Shared passphrase','Home / small business','Vulnerable to offline dictionary attack; avoid short passphrases'],
          ['WPA2-Enterprise (802.1X)','EAP credentials','Corporate','Use EAP-TLS or PEAP-MSCHAPv2; RADIUS backend required'],
          ['WPA3-Personal (SAE)','Passphrase, with PAKE','Modern home / IoT','Resistant to offline attack; transitional mode for legacy'],
          ['WPA3-Enterprise','EAP + stronger suites','Government / high-security','192-bit suite mandates AES-GCM-256, ECDHE P-384'],
          ['WPA3-OWE (Opportunistic Wireless Encryption)','None','Guest with air encryption','Replaces open SSID for public networks — no cred, still encrypted'],
        ]},
        { kind: 'callout', level: 'warn', title: 'WPA3 transition mode is a gotcha', body: `To support WPA2 clients while offering WPA3, enterprises enable "WPA3-Transition" on the SSID. The AP beacons both, clients choose. Some older clients do not handle the mixed beacon well and get stuck — if you see Intel AX200s or Samsung Galaxy S10s refusing to associate, try a parallel pure-WPA2 SSID for legacy until the fleet is refreshed.` },
      ],
    },

    {
      id: 'roaming',
      title: 'Roaming — 802.11r/k/v',
      tagline: 'How clients move between APs without dropping calls.',
      icon: '🏃',
      sections: [
        { kind: 'prose', html: `
          <p>"Roaming" is client-driven. The client decides when to leave an AP based on its own RSSI and quality thresholds. The network's job is to make the transition cheap (don't force full 802.1X again) and give the client hints about where to go next.</p>` },
        { kind: 'table', title: 'Roaming amendments', headers: ['Amendment','What it does','Enable when'], rows: [
          ['802.11r (Fast Transition, FT)','Pre-authenticates the PMK across APs; reassociation takes ~5-20ms instead of ~300ms','Voice, video — any real-time app'],
          ['802.11k','AP publishes a Neighbor Report so the client knows candidate APs','Always; helps clients roam proactively'],
          ['802.11v','AP sends BSS Transition Mgmt (BTM) requests asking client to move','"Sticky client" mitigation; load balancing'],
          ['OKC (Opportunistic Key Caching)','Pre-11r caching of PMK — proprietary, most vendors','Older clients without 11r'],
        ]},
        { kind: 'cli', title: 'IOS-XE WLC FT + 802.11k/v', code:
`wlan CORP 5 CORP
 security wpa psk set-key ascii 0 <omitted>
 no security ft over-the-ds
 security ft
 security ft reassociation-timeout 20
 bss-transition                    ! 11v
 dot11v-neighbor-list             ! 11k neighbor report
 radio policy dot11 5ghz` },
        { kind: 'callout', level: 'tip', title: 'Do not enable 11r on SSIDs with legacy clients', body: `Some older devices refuse to associate with an SSID that advertises FT. Two common patterns: (1) separate SSID for FT-capable voice handsets, or (2) use FT "Adaptive" (Cisco-specific) which only advertises FT to capable clients in the probe response. Test before enabling enterprise-wide.` },
      ],
    },

    {
      id: 'rf-design',
      title: 'RF Design & Cell Planning',
      tagline: 'Coverage vs capacity, channel reuse, and why "5 bars" is not a metric.',
      icon: '📡',
      sections: [
        { kind: 'prose', html: `
          <p>Good Wi-Fi is won or lost at RF design. Two targets compete:</p>
          <ul>
            <li><b>Coverage</b> — every square metre has at least one usable signal. Drives <em>cell size</em>.</li>
            <li><b>Capacity</b> — enough airtime per client. Drives <em>cell density</em> (more, smaller cells).</li>
          </ul>
          <p>Modern dense offices, lecture theatres, and arenas are capacity-limited. You want <b>-65 dBm coverage floor</b>, <b>cell overlap of 15–20%</b>, <b>co-channel cells separated by at least 25 dB</b>, and <b>channel reuse</b> that never places two co-channel cells adjacent.</p>` },
        { kind: 'diagram', title: '5 GHz channel reuse (UK/EU non-DFS set)', ascii:
`  +------+------+------+------+
  |  36  |  44  |  36  |  44  |
  +------+------+------+------+
  |  40  |  48  |  40  |  48  |
  +------+------+------+------+

  Four non-overlapping 20 MHz channels per 80 MHz block.
  At 40 MHz width this halves; at 80 MHz you are down to two
  non-overlapping slots. Plan at the width you intend to run.` },
        { kind: 'table', title: 'Design targets by use case', headers: ['Use case','Coverage floor','Overlap','Primary metric'], rows: [
          ['General office / data','-67 dBm','15%','Throughput, SNR ≥ 25 dB'],
          ['Voice (handset)','-65 dBm','20%','Packet loss &lt; 1%, jitter &lt; 30 ms'],
          ['Real-time video / AR','-63 dBm','20-25%','Retry rate &lt; 10%, SNR ≥ 30 dB'],
          ['High-density (auditorium)','-63 dBm','—','Clients-per-AP &lt; 50, airtime &lt; 60%'],
          ['Warehouse / tall ceilings','-70 dBm','15%','Directional antennas, ceiling or wall'],
        ]},
        { kind: 'callout', level: 'warn', title: 'Omni AP on a 12m ceiling is a waste', body: `An omni AP mounted high above a warehouse floor scatters most of its energy sideways and down the aisles where it is not wanted. Use <b>directional antennas</b> or <b>purpose-designed high-ceiling APs</b> with narrower vertical beamwidth. Same applies to stadiums, convention centres, and rail platforms.` },
      ],
    },

    {
      id: 'channels-power',
      title: 'Channel Planning & Transmit Power',
      tagline: 'DFS, TPC, RRM, and why you rarely want max power.',
      icon: '🎛️',
      sections: [
        { kind: 'prose', html: `
          <p>Two interacting knobs per AP: <b>channel</b> (which frequency) and <b>TX power</b> (how loud). Run too high on power and every AP hears every other AP — CCI (co-channel interference) saturates airtime. Run too low and coverage gaps open up.</p>
          <p>Modern WLCs ship with RRM (Radio Resource Management) that auto-tunes both. Vendors: Cisco RRM/DCA/TPC, Aruba ARM, Ruckus ChannelFly, Meraki Auto RF. Let RRM do the work — but understand the knobs so you can spot when it goes wrong.</p>` },
        { kind: 'cli', title: 'IOS-XE 9800 DCA & TPC', code:
`ap dot11 5ghz rrm channel dca interval 10 min 120
ap dot11 5ghz rrm channel dca anchor-time 3
ap dot11 5ghz rrm channel dca chan-width 40
ap dot11 5ghz rrm channel dca global auto
!
ap dot11 5ghz rrm tpc threshold -70
ap dot11 5ghz rrm tpc-auto
ap dot11 5ghz rrm tpc min 8            ! dBm
ap dot11 5ghz rrm tpc max 17` },
        { kind: 'callout', level: 'tip', title: 'DFS — use it, but watch the radar events', body: `DFS channels (52–64, 100–140 in most regions) are clean but require the AP to vacate the channel within seconds if radar is detected. In airport-adjacent or weather-radar-adjacent sites, DFS events cause frequent channel flaps that look like random packet loss. Monitor <code>show ap dot11 5ghz monitor</code> for radar events, and if they are frequent, exclude DFS from DCA.` },
      ],
    },

    {
      id: 'qos-wmm',
      title: 'Wi-Fi QoS (WMM)',
      tagline: 'Four access categories, EDCA contention, and end-to-end marking.',
      icon: '🎚️',
      sections: [
        { kind: 'table', title: 'WMM access categories', headers: ['AC','Name','DSCP in (default)','802.1p','CWmin/CWmax','Typical traffic'], rows: [
          ['AC_VO','Voice','EF (46)','6','3/7','SIP, RTP voice'],
          ['AC_VI','Video','AF41 (34)','5','7/15','Video conferencing'],
          ['AC_BE','Best Effort','DF (0)','0','15/1023','General data'],
          ['AC_BK','Background','CS1 (8)','1','15/1023','Bulk downloads, backups'],
        ]},
        { kind: 'prose', html: `
          <p>Higher-priority ACs get shorter contention windows (CWmin/CWmax) — statistically they win access to the medium more often. WMM is not a hard guarantee, just a probability weighting, which is why extremely saturated cells still drop voice.</p>
          <p>End-to-end marking: phone marks DSCP EF → switch trusts / remarks → WLC mapping table converts DSCP to WMM AC → AP transmits in AC_VO with higher priority. Break the chain anywhere (a switch remarking to 0) and voice falls back to best-effort.</p>` },
        { kind: 'callout', level: 'warn', title: 'WMM requires client support', body: `Modern clients (post-2008) all support WMM, but some IoT devices do not. Without WMM, the client cannot request AC_VO — it gets AC_BE by default. If a specific client has poor voice quality, check <code>show wireless client mac &lt;mac&gt; detail</code> on the WLC for WMM capability.` },
      ],
    },

    {
      id: 'multicast',
      title: 'Multicast over Wi-Fi',
      tagline: 'Why multicast is hard on shared RF, and the knobs to make it work.',
      icon: '📡',
      sections: [
        { kind: 'prose', html: `
          <p>Multicast is expensive in Wi-Fi: frames are sent at the <b>lowest mandatory basic rate</b> (for reliability), unencrypted per-frame (group key only), and not ACKed. A single 1 Mbps multicast stream can consume 5× the airtime of a unicast stream at 300 Mbps.</p>
          <p>Two strategies:</p>
          <ul>
            <li><b>Multicast-to-Unicast conversion</b> — WLC converts a multicast flow to per-client unicast. Each client gets it at their best rate. Scales to ~16 clients per group typically.</li>
            <li><b>Higher mandatory rates</b> — set minimum basic rate to 12 Mbps or higher so multicast is sent faster. Breaks very old clients (11b, 802.11g at cell edge).</li>
          </ul>` },
        { kind: 'cli', title: 'IOS-XE 9800 multicast-to-unicast', code:
`wireless multicast
wlan CORP 5 CORP
 mcast-buffer
 ccx aironet-iesupport
 multicast mdns               ! mDNS gateway
 radio policy dot11 5ghz
!
! Set minimum mandatory rate to 12 Mbps
ap dot11 5ghz rate RATE_6M disable
ap dot11 5ghz rate RATE_9M disable
ap dot11 5ghz rate RATE_12M mandatory` },
        { kind: 'callout', level: 'tip', title: 'IGMP snooping does not help at the air', body: `Switch IGMP snooping prevents multicast flooding across VLANs but does not reduce over-the-air overhead. An AP still floods the group to the cell unless you enable M2U. If video-multicast is failing in one cell and OK in another, the AP's M2U setting is the most likely difference.` },
      ],
    },

    {
      id: 'guest',
      title: 'Guest & Onboarding',
      tagline: 'Captive portals, PPSK, certificates, and the OWE story.',
      icon: '🎟️',
      sections: [
        { kind: 'table', title: 'Guest onboarding options', headers: ['Approach','Air encryption','Effort','Notes'], rows: [
          ['Open + captive portal','None','Low','Legacy but common. HTTP interception; vulnerable to sniffing'],
          ['OWE (WPA3)','Yes','Low','Drop-in replacement for open. No credentials. 802.11w PMF required'],
          ['PPSK / iPSK','Yes (per-user key)','Medium','Each user gets their own PSK; revocable. ISE / identity store'],
          ['802.1X with EAP-TLS (certificates)','Yes','High','Gold standard; onboarding via BYOD portal'],
        ]},
        { kind: 'callout', level: 'tip', title: 'PMF protects against deauth attacks', body: `Enable <b>802.11w (Protected Management Frames)</b> on all modern SSIDs. Without PMF, an attacker can spoof a deauth to knock any client offline. WPA3 mandates PMF; WPA2 allows optional. Always set PMF=Required on new SSIDs unless you have a documented legacy client that cannot do it.` },
      ],
    },

    {
      id: 'wifi6e-7',
      title: 'Wi-Fi 6E and Wi-Fi 7',
      tagline: '6 GHz clean spectrum, MLO, 4K-QAM, and what enterprises should plan for.',
      icon: '🚀',
      sections: [
        { kind: 'prose', html: `
          <p><b>Wi-Fi 6E</b> (2021) brought 802.11ax operation to the 6 GHz band — 1200 MHz (US) or 500 MHz (UK/EU) of fresh spectrum with <em>no legacy stations</em>. You can run seven 80 MHz channels or three 160 MHz channels cleanly. Gateway requirement: every client must support WPA3 in 6 GHz.</p>
          <p><b>Wi-Fi 7</b> (802.11be, 2024) adds:</p>
          <ul>
            <li><b>320 MHz channels</b> — only practical in 6 GHz.</li>
            <li><b>4K-QAM</b> — 20% rate bump over 1024-QAM when SNR is high.</li>
            <li><b>MLO (Multi-Link Operation)</b> — client associates on multiple bands simultaneously and uses them concurrently or as failover.</li>
            <li><b>Multi-RU</b> — more flexible OFDMA scheduling.</li>
          </ul>` },
        { kind: 'callout', level: 'tip', title: 'MLO is the one to plan for', body: `Of all Wi-Fi 7 features, <b>MLO</b> is the biggest practical win: clients get low latency AND high throughput by using 5 GHz and 6 GHz at once. But MLO only works if the AP <em>and</em> the client support the same mode (STR, NSTR, or EMLSR). Test client-by-client; do not assume it is on.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'Methodology, tools, and packet captures over the air.',
      icon: '🧰',
      sections: [
        { kind: 'prose', html: `
          <p>Wi-Fi problems hide behind friendly symptoms ("internet is slow on my laptop"). Isolate fast by asking: is this <em>one client</em>, <em>one AP</em>, <em>one SSID</em>, or <em>everyone</em>? That single data point eliminates 90% of possibilities.</p>` },
        { kind: 'cli', title: 'IOS-XE 9800 diagnostic commands', code:
`show wireless summary
show ap summary
show ap dot11 5ghz summary
show wireless client summary
show wireless client mac-address <mac> detail
show ap config 802.1x summary
show tech-support wireless client mac-address <mac>
!
! RRM / RF
show ap dot11 5ghz channel
show ap dot11 5ghz txpower
show ap dot11 5ghz monitor
!
! Over-the-air capture (if supported)
debug client mac-address <mac>` },
        { kind: 'table', title: 'Symptom → likely cause', headers: ['Symptom','Likely cause'], rows: [
          ['One client fails to associate, others fine','Client side — driver, cert chain, 802.11r mismatch'],
          ['One AP drops all clients periodically','AP CPU / crash; look at uptime; DFS radar event'],
          ['Every client roams to the same "good" AP','Sticky client — enable 11v BTM or lower RSSI threshold'],
          ['Slow throughput on one SSID only','DTIM too high, mgmt frame rate too low, WMM disabled'],
          ['Every AP shows high retry rate','CCI — too many co-channel cells; reduce power or widen reuse'],
          ['Voice quality poor at cell edge','Coverage hole &lt; -67 dBm; add AP or raise antenna'],
        ]},
        { kind: 'callout', level: 'tip', title: 'A 30-second OTA capture beats hours of guessing', body: `When a client problem will not yield to WLC logs, capture on the air. Ekahau Capture, Wireshark + AirPcap, or a spare AP in sniffer mode works. You will see <em>exactly</em> which frame fails — association response reason code, deauth, missing 4-way handshake message 4 — and it is always a specific answer.` },
      ],
    },
  ],
};
