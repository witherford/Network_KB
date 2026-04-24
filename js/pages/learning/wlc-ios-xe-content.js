// Curriculum for the Cisco IOS XE WLC (Catalyst 9800) learning centre.
// Each module renders as a page with a left rail of lessons.

export const CURRICULUM = {
  id: 'wlc-ios-xe',
  title: 'Cisco IOS XE Wireless Controller (Catalyst 9800)',
  tagline: 'From first boot to full enterprise deployment — architecture, configuration, verification, troubleshooting.',
  vendor: 'Cisco',
  platform: 'IOS XE',
  badge: 'wlc',
  estimatedMinutes: 240,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Architecture',
      icon: '🧭',
      tagline: 'Understand what the Catalyst 9800 WLC is and how it talks to APs.',
      sections: [
        { kind: 'prose', html: `
          <p>The <b>Catalyst 9800</b> is Cisco's IOS XE-based wireless LAN controller family. It replaces the older AireOS 5508/5520/8540 platform with a modern, modular IOS XE stack that runs on hardware appliances (<b>9800-L</b>, <b>9800-40</b>, <b>9800-80</b>), switch-embedded (<b>9800-CL on 9300/9400</b>), or as a virtual (<b>9800-CL</b>).</p>
          <p>Every deployment has three recurring concepts: <b>Profiles</b>, <b>Tags</b>, and <b>APs</b>. Profiles define <i>what</i> you want (an SSID, a VLAN mapping, an RF behaviour). Tags are the <i>glue</i> that bind profiles together. APs are <i>assigned</i> a tag, and inherit all of the profiles referenced by it.</p>
        `},
        { kind: 'diagram', title: 'Control & data plane at a glance', ascii: `
   ┌──────────────┐    CAPWAP DTLS 5246 (ctrl)   ┌──────────────┐
   │   Access     │ ───────────────────────────▶ │  Catalyst    │
   │   Points     │ ◀─── CAPWAP 5247 (data) ──── │  9800 WLC    │
   └──────────────┘                              └──────┬───────┘
          ▲                                             │
          │ 802.11 client traffic                       │
          │                                   ┌─────────┴─────────┐
          │                                   ▼                   ▼
      ┌───────┐                          ┌────────┐         ┌──────────┐
      │Client │                          │ RADIUS │         │ DHCP/DNS │
      └───────┘                          │  ISE   │         └──────────┘
                                         └────────┘
` },
        { kind: 'callout', level: 'info', title: 'Central vs Local switching', body: 'By default in a campus deployment client data is tunnelled back to the WLC (Central Switching). With <b>FlexConnect</b> / <b>Local Switching</b>, client data is dropped directly onto the AP\'s upstream trunk — used at branches to avoid backhauling traffic.' },
        { kind: 'prose', html: `
          <h4>The 9800 configuration model</h4>
          <p>If you remember only one thing about the 9800, remember this chain:</p>
        `},
        { kind: 'diagram', title: 'The Tag chain', ascii: `
   WLAN Profile  ──┐
                   ├──▶  Policy Tag  ──┐
   Policy Profile ─┘                   │
                                       │
   AP Join Profile ──┐                 ├──▶  Applied to AP
                     ├──▶  Site Tag  ──┤
   Flex Profile  ────┘                 │
                                       │
   RF Profile (2.4/5/6) ──▶  RF Tag  ──┘
` },
        { kind: 'table', title: 'Ports and protocols to allow end-to-end', headers: ['Purpose','Protocol','Port'], rows: [
          ['CAPWAP control','UDP','5246'],
          ['CAPWAP data','UDP','5247'],
          ['AP→WLC discovery (broadcast/DHCP opt-43)','UDP','5246'],
          ['RADIUS auth / acct / CoA','UDP','1812 / 1813 / 1700 or 3799'],
          ['NTP','UDP','123'],
          ['HTTPS (WebUI, NETCONF over TLS)','TCP','443'],
          ['SSH (CLI)','TCP','22'],
          ['NETCONF','TCP','830']
        ]}
      ]
    },

    {
      id: 'bootstrap',
      title: 'Initial Bootstrap (Day-0)',
      icon: '⚡',
      tagline: 'Bring a factory-fresh 9800 to a reachable, credentialed state.',
      sections: [
        { kind: 'prose', html: `
          <p>You have three realistic day-0 options on a 9800:</p>
          <ul>
            <li><b>Day-0 wizard</b> (GUI) — recommended. Plug a laptop into the service port, browse to <code>https://192.168.1.1</code>, run through the wizard.</li>
            <li><b>CLI bootstrap</b> — paste the block below via console.</li>
            <li><b>PnP / zero-touch</b> — if you have a staging server or DNA Center.</li>
          </ul>
        `},
        { kind: 'cli', title: 'Minimum viable bootstrap (console)', code: `enable
configure terminal
hostname wlc01
no ip domain lookup
ip domain name corp.local

! admin user for WebUI + SSH
username admin privilege 15 algorithm-type scrypt secret <StrongPass!>
aaa new-model
aaa authentication login default local
aaa authorization exec default local

! management VRF is preferred — but for a simple lab, global works
interface GigabitEthernet0   ! service port (out of band)
 vrf forwarding Mgmt-intf
 ip address 10.0.0.2 255.255.255.0
 no shut

! wireless management interface (in-band — where APs join)
interface Vlan10
 description WLC-MGMT
 ip address 10.10.10.2 255.255.255.0
 no shut

wireless management interface Vlan10

! country + time — REQUIRED before radios come up
wireless country GB
clock timezone GMT 0
ntp server 10.10.10.1

! SSH + HTTPS
crypto key generate rsa modulus 2048
ip ssh version 2
ip http secure-server
ip http authentication local
line vty 0 4
 transport input ssh
 login local

end
write memory` },
        { kind: 'checklist', title: 'Post-bootstrap verification', items: [
          'Can you ping the wireless management IP from the AP VLAN?',
          '<code>show clock</code> matches NTP source (± 1 s).',
          '<code>show wireless country configured</code> reports the right country.',
          '<code>show wireless management trustpoint</code> returns a valid trustpoint (self-signed at first — replace with a CA-issued cert for production).',
          'License level set with <code>license boot level network-advantage addon air-dna-advantage</code>.'
        ]},
        { kind: 'callout', level: 'warn', title: 'Country code is not cosmetic', body: 'APs will not power on their radios until a valid <b>wireless country</b> code is configured. This is the #1 cause of "AP joined but nothing broadcasts" on a fresh WLC.' }
      ]
    },

    {
      id: 'interfaces',
      title: 'Interfaces, VLANs & Reachability',
      icon: '🔌',
      tagline: 'VLAN design, the wireless management interface, DHCP plumbing.',
      sections: [
        { kind: 'prose', html: `
          <p>Unlike AireOS, the 9800 has <b>no "dynamic interfaces"</b>. Client VLANs are ordinary IOS XE SVIs (or VLAN IDs on a Layer-2 trunk uplink). The controller only <i>needs</i> one wireless management interface.</p>
          <p>A typical campus design uses three VLAN buckets:</p>
          <ol>
            <li><b>WLC management</b> (AP CAPWAP join + controller reachability)</li>
            <li><b>Client VLAN(s)</b> — one per user role, or one per SSID</li>
            <li><b>Guest VLAN</b> (often anchored to a DMZ controller)</li>
          </ol>
        `},
        { kind: 'cli', title: 'Uplink trunk to the distribution switch', code: `interface TenGigabitEthernet0/0/0
 description Uplink to Dist-SW Te1/0/48
 switchport
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99
 ! on a 9800-CL/appliance with L3 ports instead, use an ip address + PortChannel` },
        { kind: 'cli', title: 'DHCP relay for client VLANs', code: `! On the L3 gateway for each client VLAN (often your core, not the WLC)
interface Vlan20
 description WiFi-Corp
 ip address 10.20.0.1 255.255.0.0
 ip helper-address 10.0.5.10      ! DHCP server
 ip helper-address 10.0.5.11      ! DHCP server #2` },
        { kind: 'callout', level: 'tip', title: 'DHCP required vs proxy', body: 'In the Policy Profile you\'ll later see <code>ipv4 dhcp required</code>. Leave this <b>enabled</b> for 802.1X SSIDs — it stops a client being marked "RUN" before it has an IP. Disable it only if clients use static addressing or if you\'re tunnelling to an anchor that already enforces it.' },
        { kind: 'cli', title: 'Verify management reachability', code: `show wireless interface summary
show ip interface brief
ping vrf Mgmt-intf 10.0.0.1
ping 10.10.10.1                                 ! gateway for client VLAN
show arp vlan 10` }
      ]
    },

    {
      id: 'tags',
      title: 'Tag Architecture (Policy / Site / RF)',
      icon: '🏷️',
      tagline: 'The single most important concept on the 9800. Learn it once, apply forever.',
      sections: [
        { kind: 'prose', html: `
          <p>Every AP on a 9800 is assigned exactly one of each:</p>
          <ul>
            <li><b>Policy Tag</b> — which SSIDs to broadcast and what policy to apply</li>
            <li><b>Site Tag</b> — which AP join profile and flex profile to use; defines central vs. local switching</li>
            <li><b>RF Tag</b> — which RF profiles (2.4 GHz, 5 GHz, 6 GHz) to use</li>
          </ul>
          <p>If you don't assign tags, the AP falls through to the <b>default-policy-tag</b>, <b>default-site-tag</b>, and <b>default-rf-tag</b>. For anything beyond a lab, make your own.</p>
        `},
        { kind: 'diagram', title: 'How tags bind everything', ascii: `
  ┌────────────────────┐      ┌────────────────────┐
  │  WLAN-Corp         │      │  Policy-Corp       │
  │  (SSID profile)    │◀────▶│  (VLAN, ACL, QoS)  │
  └────────────────────┘      └────────────────────┘
           │                           │
           └──────────┬────────────────┘
                      ▼
               ┌─────────────┐       ┌─────────────┐      ┌───────────┐
               │ Policy-Tag  │──┐    │  Site-Tag   │      │  RF-Tag   │
               │  Corp-POL   │  │    │  Corp-SITE  │      │  Corp-RF  │
               └─────────────┘  │    └─────────────┘      └───────────┘
                                │          │                    │
                                └──────────┴───────┬────────────┘
                                                   ▼
                                            ┌─────────────┐
                                            │     AP      │
                                            └─────────────┘
` },
        { kind: 'cli', title: 'Create a Policy Tag and map SSID → Policy', code: `wireless tag policy Corp-POL
 description "Corp APs — SSIDs + VLAN mapping"
 wlan Corp-WLAN policy Corp-POL-Profile
 wlan Guest-WLAN policy Guest-POL-Profile` },
        { kind: 'cli', title: 'Create a Site Tag (central switching)', code: `wireless tag site Corp-SITE
 description "HQ campus — central switching"
 ap-profile Corp-AP-JOIN
 ! no enable-local-site  ← omit for central switching; add for FlexConnect local` },
        { kind: 'cli', title: 'Create an RF Tag', code: `wireless tag rf Corp-RF
 description "HQ RF baseline"
 24ghz-rf-policy Corp-2_4
 5ghz-rf-policy  Corp-5
 6ghz-rf-policy  Corp-6` },
        { kind: 'cli', title: 'Assign tags to APs — in bulk by MAC or individually', code: `! by MAC (static assignment — survives reboot)
ap aaaa.bbbb.cccc
 policy-tag Corp-POL
 site-tag   Corp-SITE
 rf-tag     Corp-RF

! or with location-based rules (filter)
wireless tag site Corp-SITE
ap location filter add FILTER-HQ
ap filter name FILTER-HQ
 ap name-regex ^HQ-.*
 tag policy Corp-POL
 tag site   Corp-SITE
 tag rf     Corp-RF` },
        { kind: 'callout', level: 'warn', title: 'Tag changes reboot the AP', body: 'Changing a Site Tag (or moving an AP between site tags with different switching modes) causes a CAPWAP re-join. Schedule it.' }
      ]
    },

    {
      id: 'wlan',
      title: 'WLAN Profile (SSID)',
      icon: '📶',
      tagline: 'Define what the SSID looks like on-air — name, bands, L2 security.',
      sections: [
        { kind: 'prose', html: `
          <p>A <b>WLAN profile</b> is <i>the SSID</i>. It answers: what's the network name, what band(s) will it live on, and what L2 security? It deliberately does <b>not</b> contain VLAN or ACL — that belongs in the Policy Profile.</p>
        `},
        { kind: 'cli', title: 'Corp SSID (WPA2-Enterprise, 802.1X)', code: `wlan Corp-WLAN 1 Corp
 ssid Corp                            ! broadcast name
 no shutdown
 radio policy dot11 5ghz
 radio policy dot11 6ghz
 broadcast-ssid
 security wpa psk                      ! starts as PSK; override below
 no security wpa akm psk
 security wpa akm dot1x
 security dot1x authentication-list AAA-ISE
 security pmf mandatory                ! WPA3 parity — safe on modern clients` },
        { kind: 'cli', title: 'Guest SSID (open + web auth)', code: `parameter-map type webauth Guest-WEB
 type consent                          ! or "webauth" for credential portal
 banner text "^CWelcome to Guest Wi-Fi^C"

wlan Guest-WLAN 2 Guest
 ssid Guest
 no shutdown
 radio policy dot11 24ghz
 radio policy dot11 5ghz
 no security wpa
 no security wpa wpa2
 no security wpa akm dot1x
 no security wpa wpa2 ciphers aes
 security web-auth
 security web-auth authentication-list AAA-GUEST
 security web-auth parameter-map Guest-WEB` },
        { kind: 'callout', level: 'tip', title: 'Name vs ID vs profile name', body: 'The 9800 distinguishes three things: the <b>WLAN profile name</b> (config handle, e.g. <code>Corp-WLAN</code>), the <b>WLAN ID</b> (numeric, 1-4096, rarely matters), and the <b>SSID</b> that clients see. Keep them aligned — you will save yourself hours.' },
        { kind: 'cli', title: 'Checks', code: `show wlan summary
show wlan id 1                         ! full profile dump
show wlan name Corp-WLAN` }
      ]
    },

    {
      id: 'policy-profile',
      title: 'Policy Profile',
      icon: '🧩',
      tagline: 'Where WLAN meets VLAN — the place for client policy.',
      sections: [
        { kind: 'prose', html: `
          <p>If the WLAN is "what goes out on-air", the <b>Policy Profile</b> is "what happens to the client once it's on the network":</p>
          <ul>
            <li>Which VLAN (or VLAN group) the client lands in</li>
            <li>Whether DHCP is required</li>
            <li>ACLs (pre-auth, post-auth, IPv4/IPv6)</li>
            <li>QoS, AAA override, mDNS, IPv6 policy</li>
            <li>Session timeout / idle timeout</li>
          </ul>
        `},
        { kind: 'cli', title: 'Corp policy profile — central switching', code: `wireless profile policy Corp-POL-Profile
 description "Corp users — VLAN 20"
 vlan 20
 no shutdown
 no central association                ! only disable for Flex local-switching
 aaa-override                          ! let RADIUS return VLAN, ACL, role
 nac                                   ! enable CoA
 ipv4 dhcp required
 idle-timeout 3600
 session-timeout 28800
 service-policy input  QOS-CORP-IN
 service-policy output QOS-CORP-OUT` },
        { kind: 'cli', title: 'Guest policy profile — with anchor', code: `wireless profile policy Guest-POL-Profile
 description "Guest — anchored to DMZ"
 no shutdown
 mobility anchor 10.99.0.2 priority 3  ! DMZ anchor WLC
 no central switching                   ! tunnel anchor handles the VLAN
 ipv4 dhcp required
 idle-timeout 1800
 session-timeout 14400` },
        { kind: 'callout', level: 'info', title: 'aaa-override vs nac', body: '<b>aaa-override</b> lets RADIUS <i>return</i> attributes (VLAN, dACL, URL-redirect). <b>nac</b> lets RADIUS <i>push</i> changes later via CoA (Change of Authorization). For ISE posture & CWA you need both.' }
      ]
    },

    {
      id: 'apjoin',
      title: 'AP Join Profile & Country',
      icon: '🛰️',
      tagline: 'Control how APs talk to the WLC — CAPWAP, credentials, LEDs.',
      sections: [
        { kind: 'prose', html: `
          <p>The <b>AP Join Profile</b> owns everything about the AP-to-WLC relationship: CAPWAP intervals, NTP, admin credentials on the AP shell, LED state, client statistics timers, TrustSec SXP, LAG.</p>
        `},
        { kind: 'cli', title: 'AP join profile baseline', code: `ap profile Corp-AP-JOIN
 description "HQ AP defaults"
 country GB

 ! admin creds on the AP CLI itself (not WLC)
 mgmtuser username apadmin password 0 <StrongPass!> secret 0 <EnableSecret!>

 ! CAPWAP keepalives — tighten for faster failover
 capwap backup primary  wlc01 10.10.10.2
 capwap backup secondary wlc02 10.10.10.3
 capwap fallback-enabled

 ! NTP + syslog from the AP side
 ntp ip 10.10.10.1
 syslog host 10.0.5.200

 ! disable LEDs at night? blink on join?
 led-brightness-level 8

 ! firmware — usually auto; pin for tightly managed sites
 !   (handled via "wireless ap image" on the WLC, see Upgrades module)` },
        { kind: 'callout', level: 'warn', title: 'AP discovery order', body: 'An AP discovers its WLC via (1) statically-primed values, (2) DHCP Option 43, (3) DNS <code>CISCO-CAPWAP-CONTROLLER.&lt;domain&gt;</code>, (4) broadcast on the local subnet. Option 43 is the most reliable in a routed network.' },
        { kind: 'cli', title: 'DHCP Option 43 example (IOS DHCP server)', code: `ip dhcp pool AP-JOIN
 network 10.30.0.0 255.255.0.0
 default-router 10.30.0.1
 option 43 hex f104.0a0a.0a02   ! type=f1 len=04 payload=10.10.10.2 (WLC mgmt IP in hex)
 option 60 ascii "Cisco AP c9130"` }
      ]
    },

    {
      id: 'security',
      title: 'Security: WPA3 / WPA2 / 802.1X / PSK / iPSK',
      icon: '🔐',
      tagline: 'Pick an AKM, get PMF right, and don\'t leave yourself a KRACK.',
      sections: [
        { kind: 'prose', html: `
          <p>On the 9800, security lives on the <b>WLAN Profile</b>: the cipher (AES), the AKM (Auth & Key Management: PSK, 802.1X, SAE, FT, OWE), and PMF (Protected Management Frames).</p>
        `},
        { kind: 'table', title: 'Choosing an AKM', headers: ['Use case','Recommendation','Notes'], rows: [
          ['Corporate, managed clients','WPA3-Enterprise (192-bit optional) <b>OR</b> WPA2-Enterprise with PMF mandatory','Run 802.1X with ISE. Use PEAP-MSCHAPv2 only if you must; prefer EAP-TLS.'],
          ['Shared network (small site)','WPA3-Personal (SAE) with transition mode','Transition keeps WPA2 clients working. Drop transition once audited.'],
          ['Per-user PSK (hotel, student housing)','iPSK (Identity PSK) with ISE','Each client gets a per-device PSK, mapped by MAC.'],
          ['Guest / sponsored','Open + Central Web Auth, or OWE-only','OWE encrypts, but doesn\'t authenticate. CWA is cleaner for branded portals.'],
          ['Legacy IoT (WEP, really?)','Avoid. Segment onto a dedicated SSID and VLAN.','Don\'t enable WPA-TKIP unless absolutely forced to.']
        ]},
        { kind: 'cli', title: 'WPA3-Enterprise with 802.1X + PMF mandatory', code: `wlan Corp-WLAN 1 Corp
 no shutdown
 security wpa wpa3
 security wpa akm dot1x-sha256
 security wpa wpa3 gcmp-256            ! optional — 192-bit mode
 security pmf mandatory
 security dot1x authentication-list AAA-ISE
 no security wpa wpa2                  ! WPA3-only (modern clients)` },
        { kind: 'cli', title: 'WPA2 + WPA3 transition (safe default)', code: `wlan Corp-WLAN 1 Corp
 no shutdown
 security wpa wpa2 ciphers aes
 security wpa wpa3
 security wpa akm dot1x
 security wpa akm sae                  ! WPA3-Personal option
 security pmf optional                 ! "optional" = transition; "mandatory" = WPA3-only` },
        { kind: 'cli', title: 'iPSK (per-device PSK, via ISE)', code: `! WLAN — the key type doesn't matter; ISE overrides it per device
wlan IPSK-WLAN 3 Secure
 no shutdown
 security wpa psk set-key ascii 0 <dummy-psk>
 security wpa akm psk
 mac-filtering MAC-FILTER-LIST
 security dot1x authentication-list AAA-ISE

! AAA returns the real PSK via Cisco-AVPair: psk-mode=ascii, psk=<per-device-key>` },
        { kind: 'callout', level: 'warn', title: 'PMF is not optional for WPA3', body: 'WPA3 <i>requires</i> PMF mandatory. If you set <code>security wpa wpa3</code> with <code>security pmf disabled</code> the WLAN will fail to enable.' }
      ]
    },

    {
      id: 'aaa-radius',
      title: 'AAA / RADIUS / ISE Integration',
      icon: '🧾',
      tagline: 'Talk to RADIUS properly — groups, method lists, CoA, source interface.',
      sections: [
        { kind: 'prose', html: `
          <p>On IOS XE, RADIUS always goes through the modern <b>aaa-server-group</b> / <b>method-list</b> model. AireOS-style "RADIUS server 1/2/3" doesn't apply. Spend 10 minutes getting this right once, and every SSID afterwards is a one-liner.</p>
        `},
        { kind: 'cli', title: 'RADIUS servers + server-group', code: `radius server ISE-01
 address ipv4 10.0.5.50 auth-port 1812 acct-port 1813
 key 7 <radius-shared-secret>
 automate-tester username probe ignore-acct-port probe-on

radius server ISE-02
 address ipv4 10.0.5.51 auth-port 1812 acct-port 1813
 key 7 <radius-shared-secret>
 automate-tester username probe ignore-acct-port probe-on

aaa group server radius AAA-ISE-SG
 server name ISE-01
 server name ISE-02
 deadtime 5
 ip radius source-interface Vlan10` },
        { kind: 'cli', title: 'Method lists — per-SSID auth/acct/auth-proxy', code: `aaa authentication dot1x AAA-ISE group AAA-ISE-SG
aaa authorization  network AAA-ISE group AAA-ISE-SG
aaa accounting    identity AAA-ISE start-stop group AAA-ISE-SG

! Guest web-auth list
aaa authentication login    AAA-GUEST group AAA-ISE-SG local
aaa authorization  network  AAA-GUEST group AAA-ISE-SG
aaa accounting    identity  AAA-GUEST start-stop group AAA-ISE-SG` },
        { kind: 'cli', title: 'Change of Authorization (CoA) — required for ISE posture / guest flows', code: `aaa server radius dynamic-author
 client 10.0.5.50 server-key <radius-shared-secret>
 client 10.0.5.51 server-key <radius-shared-secret>
 auth-type any
 port 1700` },
        { kind: 'checklist', title: 'Before you go live', items: [
          'Shared secret matches on WLC and ISE <i>exactly</i> (watch for trailing spaces).',
          'WLC is defined as a Network Access Device (NAD) on ISE with the same IP the RADIUS packet sources from.',
          'Firewall permits UDP 1812/1813 <i>and</i> UDP 1700 (or 3799) in both directions for CoA.',
          '<code>test aaa group AAA-ISE-SG testuser Cisco123 new-code</code> returns <b>Success</b>.',
          'ISE live-log shows an Access-Accept with the expected Authorization Profile.'
        ]}
      ]
    },

    {
      id: 'rf-rrm',
      title: 'RF Profiles & RRM',
      icon: '📡',
      tagline: 'Channels, power, 6 GHz, RRM — the part that actually decides user experience.',
      sections: [
        { kind: 'prose', html: `
          <p><b>RRM</b> (Radio Resource Management) is the closed-loop system the WLC uses to tune channels, power, and band behaviour. It has three pieces:</p>
          <ul>
            <li><b>DCA</b> (Dynamic Channel Assignment) — picks channels, avoids interference</li>
            <li><b>TPC</b> (Transmit Power Control) — picks each radio\'s power</li>
            <li><b>CHD</b> (Coverage Hole Detection) — raises power where clients complain</li>
          </ul>
          <p>RF <b>profiles</b> let you tune these per site. A library branch office does not want the same settings as a dense open-plan HQ.</p>
        `},
        { kind: 'cli', title: 'A high-density 5 GHz RF profile', code: `ap dot11 5ghz rf-profile HQ-5
 description "HQ 5 GHz — high density"
 channel chan-width 40                 ! avoid 80 MHz in dense deployments
 tx-power-control min 8                ! dBm floor
 tx-power-control max 17
 coverage data-rssi -72
 coverage voice-rssi -70
 rate 6 disable                        ! disable low rates to force fast-only
 rate 9 disable
 rate 11 disable
 rate 12 mandatory
 rate 18 supported
 rate 24 supported
 rate 36 supported
 rate 48 supported
 rate 54 supported
 no shutdown` },
        { kind: 'cli', title: '6 GHz profile — unlicensed, PSC only', code: `ap dot11 6ghz rf-profile HQ-6
 description "HQ 6 GHz — PSC channels"
 channel psc-enforce
 tx-power-control min 6
 tx-power-control max 18
 no shutdown` },
        { kind: 'cli', title: 'DCA — pause during business hours if needed', code: `ap dot11 5ghz rrm channel dca anchor-time 3     ! run DCA at 03:00
ap dot11 5ghz rrm channel dca interval 24h
ap dot11 5ghz rrm channel dca sensitivity medium` },
        { kind: 'callout', level: 'tip', title: 'Kill your low data rates', body: 'Disabling 1/2/5.5/6/9 Mbps rates is the cheapest performance win on a 2.4 GHz network. A stale 1 Mbps beacon consumes ~10x the air-time of a 12 Mbps one.' }
      ]
    },

    {
      id: 'flexconnect',
      title: 'FlexConnect / Branch Deployments',
      icon: '🏚️',
      tagline: 'Keep data local; survive WAN outages.',
      sections: [
        { kind: 'prose', html: `
          <p>FlexConnect puts the AP into <b>local switching</b> mode: the AP drops client traffic straight onto its uplink port, VLAN-tagged, without tunnelling back to the WLC. Useful at branches where:</p>
          <ul>
            <li>You don\'t want every client packet crossing the WAN</li>
            <li>Users must keep working if the WAN dies (Standalone mode)</li>
            <li>You want per-site ACLs enforced on the AP</li>
          </ul>
        `},
        { kind: 'cli', title: 'Flex Profile + local-switching site tag', code: `wireless profile flex Branch-FLEX
 description "Branch Flex profile"
 native-vlan-id 10
 vlan-name Corp
  vlan-id 20
 vlan-name Guest
  vlan-id 30
 arp-caching
 local-auth ap eap-fast profile BranchAuth

wireless tag site Branch-SITE
 description "Branch 1"
 ap-profile Branch-AP-JOIN
 flex-profile Branch-FLEX
 enable-local-site` },
        { kind: 'cli', title: 'Policy Profile — central auth, local switching', code: `wireless profile policy Branch-POL-Profile
 no central switching                  ! client data stays on AP
 no central dhcp                       ! use branch DHCP server
 no central association                ! AP terminates encryption
 vlan 20                               ! default client VLAN at branch
 aaa-override
 no shutdown` },
        { kind: 'callout', level: 'info', title: 'Standalone vs Connected', body: 'Flex APs operate in two states: <b>Connected</b> (WLC reachable — 802.1X still goes to ISE) and <b>Standalone</b> (WLC unreachable — AP does local auth via configured methods, or fails open per your policy). Plan your fallback methods explicitly per WLAN.' }
      ]
    },

    {
      id: 'mobility',
      title: 'Mobility & Roaming',
      icon: '🔁',
      tagline: 'Mobility groups, 802.11r, anchors, guest tunneling.',
      sections: [
        { kind: 'prose', html: `
          <p>Two different conversations live under one word:</p>
          <ol>
            <li><b>Controller mobility</b> — how <i>WLCs</i> exchange client context between each other (mobility groups, anchors).</li>
            <li><b>Client roaming</b> — how a <i>single client</i> moves between APs with minimal disruption (802.11r, OKC, 802.11k/v).</li>
          </ol>
        `},
        { kind: 'cli', title: 'Mobility group (between WLCs)', code: `wireless mobility group name CAMPUS
wireless mobility group member ip 10.10.10.3 public-ip 10.10.10.3 group CAMPUS \\
  mac-address aaaa.bbbb.cccc
! On the second WLC, mirror the above with the first WLC's values.` },
        { kind: 'cli', title: '802.11r Fast Transition on the SSID', code: `wlan Corp-WLAN 1 Corp
 security ft                           ! enable FT
 security wpa akm dot1x
 security wpa akm ft dot1x             ! FT + 802.1X
 security ft over-the-ds               ! allow OTDS (usually leave on)` },
        { kind: 'cli', title: 'Guest anchor (two controllers)', code: `! On the FOREIGN WLC (where APs live):
wireless profile policy Guest-POL-Profile
 mobility anchor 10.99.0.2 priority 3

! On the ANCHOR WLC (DMZ):
wireless profile policy Guest-POL-Profile
 mobility anchor                        ! makes this WLC the anchor
 vlan 99                                 ! guest VLAN lives here` },
        { kind: 'callout', level: 'tip', title: 'Over-the-air vs over-the-DS', body: 'Over-the-DS is usually faster and doesn\'t need the client to reassociate twice. Older clients may mishandle it — if you see odd drops on old phones, try OTA.' }
      ]
    },

    {
      id: 'ha-sso',
      title: 'High Availability (RMI + SSO)',
      icon: '🛟',
      tagline: 'Pair two WLCs into one logical brain. AP/client state survives failover.',
      sections: [
        { kind: 'prose', html: `
          <p>9800 HA is <b>Stateful Switch-Over (SSO)</b> between two physical boxes connected over a dedicated <b>Redundancy Port</b> (RP). With <b>RMI</b> (Redundancy Management Interface) you add a gateway check so the active won\'t stay active if it loses its north-bound link.</p>
        `},
        { kind: 'diagram', title: 'Physical layout', ascii: `
   ┌───────────────┐  RP (direct link, UDP 7891)  ┌───────────────┐
   │ WLC-A (Active)│──────────────────────────────│ WLC-B (Stby)  │
   │   RMI IP-A    │                              │   RMI IP-B    │
   └───────┬───────┘                              └───────┬───────┘
           │ wireless mgmt IP (virtual, follows active)    │
           └───────────────┬───────────────────────────────┘
                           ▼
                     Uplink VLAN
` },
        { kind: 'cli', title: 'Configure RP + RMI (on Primary)', code: `chassis redundancy ha-interface GigabitEthernet0/0/0
 local-ip   10.77.77.1 255.255.255.0 remote-ip 10.77.77.2
chassis redundancy keep-alive-timer 1
chassis redundancy keep-alive-retries 3

redundancy
 mode sso

! RMI — adds gateway health to the HA decision
chassis redundancy ha-interface GigabitEthernet0/0/1 local-ip 10.10.10.5 remote-ip 10.10.10.6 \\
  gateway 10.10.10.1

! Set chassis priority — higher wins
chassis 1 priority 2
chassis 2 priority 1

write memory
reload` },
        { kind: 'cli', title: 'Verify HA', code: `show chassis
show redundancy
show redundancy states
show chassis ha-status active` },
        { kind: 'callout', level: 'warn', title: 'RP link is not optional', body: 'Without an RP, SSO cannot sync state. Direct fibre or copper is required — do NOT run RP across an L2 switch in production; latency and flaps will cause split-brain.' }
      ]
    },

    {
      id: 'monitoring',
      title: 'Monitoring & Telemetry',
      icon: '📊',
      tagline: 'Know what the WLC knows — fast.',
      sections: [
        { kind: 'cli', title: 'Inventory', code: `show wireless summary
show ap summary
show ap config general
show wireless client summary
show wireless client mac-address aaaa.bbbb.cccc detail` },
        { kind: 'cli', title: 'Config verification', code: `show wlan summary
show wireless profile policy summary
show wireless profile policy detailed Corp-POL-Profile
show wireless tag policy detailed Corp-POL
show wireless tag site   detailed Corp-SITE
show wireless tag rf     detailed Corp-RF` },
        { kind: 'cli', title: 'Live RF', code: `show ap dot11 5ghz summary
show ap dot11 5ghz channel
show ap dot11 5ghz txpower
show ap auto-rf dot11 5ghz
show ap rf-profile summary` },
        { kind: 'cli', title: 'Accurate packet captures (EPC)', code: `! Capture on the WLC's own control plane (useful for CAPWAP, RADIUS)
monitor capture MYCAP interface Vlan10 both
monitor capture MYCAP match any
monitor capture MYCAP buffer size 10
monitor capture MYCAP limit duration 60
monitor capture MYCAP start
  ! ... reproduce the issue ...
monitor capture MYCAP stop
monitor capture MYCAP export location flash:mycap.pcap` },
        { kind: 'cli', title: 'Embedded Wireless Client Debug (radio-active)', code: `debug wireless mac aaaa.bbbb.cccc
  ! reproduce the client join — then:
show logging profile wireless start last 3 min to-file bootflash:join.log
more bootflash:join.log
no debug wireless mac aaaa.bbbb.cccc` }
      ]
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting Workflow',
      icon: '🧯',
      tagline: 'A repeatable path from "it\'s broken" to "here\'s why".',
      sections: [
        { kind: 'prose', html: `
          <p>Most wireless complaints come down to one of four stories. Walk this tree before reaching for a packet capture.</p>
        `},
        { kind: 'diagram', title: 'Client-join decision tree', ascii: `
   "Client can\'t get on Wi-Fi"
              │
              ▼
      Does SSID broadcast?
       │          │
      Yes         No  ──▶  Check WLAN state (shutdown?), Policy Tag maps WLAN?, AP joined?
       │
       ▼
   Does client see an assoc response?
       │          │
      Yes         No  ──▶  RF issue (RSSI), band steering, 802.11w mismatch
       │
       ▼
   Does 802.1X complete?
       │          │
      Yes         No  ──▶  RADIUS reachability, shared secret, ISE Auth-Policy rules
       │
       ▼
   Does client get DHCP lease?
       │          │
      Yes         No  ──▶  VLAN trunk, DHCP helper, "ipv4 dhcp required"
       │
       ▼
   Is client in RUN state?
       │          │
      Yes         No  ──▶  Check Policy Profile "central switching", ACL, aaa-override
       │
       ▼
   Traffic flows. Done.
` },
        { kind: 'checklist', title: '"AP won\'t join the WLC"', items: [
          'AP is on a VLAN that can reach the WLC\'s wireless management IP (ping, trace).',
          'DHCP returns Option 43 (or DNS resolves <code>CISCO-CAPWAP-CONTROLLER</code>).',
          'AP\'s time is sane (invalid cert clock is common after long power-off).',
          '<code>show wireless country configured</code> lists the AP\'s country.',
          '<code>show ap join stats summary</code> — look for <i>Discovery Phase</i> counts increasing but <i>Join Phase</i> at 0 → certificate / mgmt-IP issue.',
          'WLC\'s trustpoint chain is valid: <code>show crypto pki trustpoints | i CA</code>.'
        ]},
        { kind: 'checklist', title: '"Client associates but has no IP"', items: [
          'In Policy Profile, <code>ipv4 dhcp required</code> is on — and DHCP is actually reachable.',
          'Client VLAN is allowed on the AP\'s upstream trunk (central) or the AP\'s port (flex).',
          'DHCP helper is configured on the SVI that owns the client VLAN.',
          '<code>debug wireless mac &lt;mac&gt;</code> shows DHCP_DISCOVER but no OFFER → IP helper / scope exhausted.',
          'ARP isn\'t being snooped away — check <code>ip dhcp snooping</code> on the upstream switch.'
        ]},
        { kind: 'cli', title: 'Useful one-liners', code: `show wireless stats client detail
show wireless stats dhcp
show wireless stats mobility
show wireless trace ra internal client mac aaaa.bbbb.cccc

! CAPWAP-level
show capwap client summary                ! from the AP CLI
show ap capwap summary                    ! from the WLC` }
      ]
    },

    {
      id: 'upgrade',
      title: 'Software Upgrade (ISSU / Normal)',
      icon: '⬆️',
      tagline: 'Move to a new IOS XE release without breaking users.',
      sections: [
        { kind: 'prose', html: `
          <p>You have three upgrade modes on a 9800:</p>
          <ul>
            <li><b>Install mode (normal)</b> — reload-based; simple and reliable.</li>
            <li><b>ISSU</b> (In-Service Software Upgrade) — requires HA SSO pair; minimal client impact.</li>
            <li><b>AP image pre-download</b> — happens alongside either of the above.</li>
          </ul>
        `},
        { kind: 'cli', title: 'Pre-download AP image (no AP reload yet)', code: `wireless config download protocol tftp
install add file tftp://10.0.5.200/c9800-universalk9_wlc.17.15.01.SPA.bin
ap image predownload
show ap image summary                     ! watch Predownload Complete count rise` },
        { kind: 'cli', title: 'Normal install upgrade', code: `copy tftp://10.0.5.200/c9800-universalk9_wlc.17.15.01.SPA.bin bootflash:
install add file bootflash:c9800-universalk9_wlc.17.15.01.SPA.bin activate commit
! WLC reloads and comes up on new image. APs swap to the matching AP image on rejoin.` },
        { kind: 'cli', title: 'ISSU (HA SSO pair)', code: `install add file bootflash:c9800-universalk9_wlc.17.15.01.SPA.bin
install activate issu                     ! activates on standby, failover, then activates on ex-active
install commit` },
        { kind: 'checklist', title: 'Pre-upgrade sanity', items: [
          'Full <code>show tech wireless</code> saved off-box.',
          '<code>show redundancy</code> shows <b>SSO</b> and both chassis Active/Standby Hot.',
          'AP image pre-download is <b>Complete</b> on every AP.',
          'License stack is compliant: <code>show license summary</code> = <b>AUTHORIZED</b>.',
          'Maintenance window confirmed — normal install is <i>not</i> hitless without HA.'
        ]}
      ]
    }
  ]
};
