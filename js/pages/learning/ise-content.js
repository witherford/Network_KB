// Cisco ISE learning centre.
export const CURRICULUM = {
  id: 'ise',
  title: 'Cisco ISE',
  tagline: 'Identity Services Engine — 802.1X, MAB, profiling, posture, BYOD, TrustSec, guest.',
  estimatedMinutes: 280,
  modules: [
    {
      id: 'overview',
      icon: '🧾',
      title: 'Overview & Architecture',
      tagline: 'What ISE is, where it lives, the persona model.',
      sections: [
        { kind: 'prose', html: `<p><b>Cisco ISE</b> is a policy server for network access. It speaks RADIUS (and TACACS+ for device admin) to switches, WLCs and firewalls, and decides who/what can connect, where they land (VLAN/dACL/SGT), and under what conditions (posture, time, location).</p><p>ISE is built from <b>personas</b> — roles a node plays in a deployment. The same software image runs on every node; what it does depends on persona assignment.</p>` },
        { kind: 'table', title: 'ISE personas',
          headers: ['Persona', 'Role', 'How many'],
          rows: [
            ['PAN — Policy Administration Node', 'GUI, policy authoring, configuration sync source', '1 primary + 1 secondary'],
            ['MNT — Monitoring & Troubleshooting', 'Live logs, reports, alarms', '1 primary + 1 secondary'],
            ['PSN — Policy Service Node', 'Handles RADIUS/TACACS, profiling, posture', 'Up to ~50 (large deployment)'],
            ['pxGrid Controller', 'Publishes/subscribes context (sessions, SGTs) to FTD/Stealthwatch/etc.', '1–2'],
            ['TC-NAC / Threat-Centric', 'Pulls threat data from AMP/Talos to drive ANC quarantine', 'Optional']
          ]
        },
        { kind: 'diagram', title: 'Typical 6-node deployment',
          ascii: `   +-------+   +-------+
   | PAN-A |---| PAN-B |    (primary/secondary, also MNT in many designs)
   +-------+   +-------+
       |           |
   +---+---+   +---+---+
   | PSN-1 |   | PSN-2 |    (PSNs sit close to the access network)
   +-------+   +-------+
       |           |
   Switches / WLCs / Firewalls (RADIUS clients)
       |
   pxGrid → FMC, Stealthwatch, Splunk, third-party SIEMs` }
      ]
    },
    {
      id: 'auth-flow',
      icon: '🔄',
      title: 'Authentication Flow',
      tagline: 'Authentication policy → authorization policy → result.',
      sections: [
        { kind: 'prose', html: `<p>ISE evaluates every RADIUS request through two stages:</p><ol><li><b>Authentication policy</b> — pick the identity store (AD, internal, certificates) and an allowed protocol set (PEAP, EAP-TLS, MAB, etc.). Result: the user is identified.</li><li><b>Authorization policy</b> — given the identity + context (location, AD group, profile, posture, time), decide the result: VLAN, dACL, SGT, redirect URL.</li></ol>` },
        { kind: 'cli', title: 'Test from the command line',
          code: `# Test a RADIUS Access-Request directly to ISE PSN
radtest jdoe Pass123! 10.10.10.50 0 sharedsecret

# Test from a Cisco switch
test aaa group radius user jdoe Pass123! new-code
test aaa group radius server 10.10.10.50 jdoe Pass123! new-code

# Wireshark on PSN
tcpdump -i eth0 -nn 'udp port 1812 or udp port 1813' -w /tmp/auth.pcap`,
          desc: 'Always run "test aaa" from the actual NAD that will service the user — proves shared secret, source IP and reachability are correct.' }
      ]
    },
    {
      id: 'dot1x-mab',
      icon: '🔐',
      title: '802.1X & MAB',
      tagline: 'Wired NAC fundamentals, the closed/low-impact/monitor modes.',
      sections: [
        { kind: 'prose', html: `<p><b>802.1X</b> is the IEEE standard for port-based access control. The supplicant (endpoint) authenticates to the authenticator (switch/AP) which proxies to ISE via RADIUS. Endpoints that don't speak 802.1X (printers, IoT) fall back to <b>MAB</b> (MAC Authentication Bypass) — the switch sends the MAC as username + password.</p><p>Three deployment modes:</p><ul><li><b>Monitor</b> — log only, never deny. Day 1 of a rollout.</li><li><b>Low-impact</b> — pre-auth ACL allows essentials (DHCP/DNS/AD), 802.1X overlays full access.</li><li><b>Closed</b> — nothing without auth. End state.</li></ul>` },
        { kind: 'cli', title: 'Cisco IOS-XE switch — 802.1X + MAB',
          code: `! AAA
aaa new-model
aaa authentication dot1x default group radius
aaa authorization network default group radius
aaa accounting dot1x default start-stop group radius

! RADIUS server group + CoA
radius server ISE-PSN1
 address ipv4 10.10.10.50 auth-port 1812 acct-port 1813
 key 7 <encrypted>
radius-server vsa send authentication
aaa server radius dynamic-author
 client 10.10.10.50 server-key cisco

! Global enables
dot1x system-auth-control
ip device tracking probe auto-source
device-tracking tracking
device-tracking policy IPDT
 tracking enable

! Access-port template (low-impact mode)
interface range Gi1/0/1-48
 switchport mode access
 switchport access vlan 10
 device-tracking attach-policy IPDT
 authentication periodic
 authentication timer reauthenticate server
 access-session host-mode multi-auth
 access-session port-control auto
 dot1x pae authenticator
 dot1x timeout tx-period 7
 mab
 service-policy type control subscriber DOT1X_MAB_POLICY
 spanning-tree portfast
 spanning-tree bpduguard enable

! Modern policy-map style sequence
policy-map type control subscriber DOT1X_MAB_POLICY
 event session-started match-all
  10 class always do-until-failure
   10 authenticate using dot1x priority 10
   20 authenticate using mab priority 20
 event authentication-failure match-first
  10 class DOT1X_FAILED do-until-failure
   10 authenticate using mab priority 20`,
          desc: 'multi-auth allows multiple endpoints behind a phone or hub. The policy-map is the modern replacement for the legacy "authentication order/priority" CLI.' },
        { kind: 'cli', title: 'Verify on the switch',
          code: `show authentication sessions interface Gi1/0/5 details
show access-session interface Gi1/0/5 details
show dot1x interface Gi1/0/5
show mab interface Gi1/0/5
show device-tracking database`
        }
      ]
    },
    {
      id: 'profiling',
      icon: '🧠',
      title: 'Profiling',
      tagline: 'How ISE figures out what device just plugged in.',
      sections: [
        { kind: 'prose', html: `<p>ISE runs a probe-driven profiler that classifies endpoints by combining many signals:</p><ul><li><b>RADIUS</b> — Calling-Station-ID (MAC), NAS-Port-Type, attributes from the NAD.</li><li><b>DHCP</b> — DHCP options 12 (hostname), 55 (parameter list), 60 (vendor-class).</li><li><b>HTTP</b> — User-Agent header captured by the WLC redirect or NetFlow.</li><li><b>SNMP</b> — query the NAD for CDP/LLDP neighbour info, ARP cache.</li><li><b>NMAP</b> — active scan of the endpoint.</li><li><b>NetFlow</b> — per-flow telemetry (large deployments).</li><li><b>AD probe</b> — query AD computer object.</li></ul><p>Endpoints land in a <b>profile</b> (e.g. "Cisco-IP-Phone-7975", "Apple-iPhone") which authorization policy can match.</p>` },
        { kind: 'callout', level: 'tip', title: 'DHCP probe is gold',
          body: `Send DHCP traffic to the PSN with "ip helper-address <psn-ip>" on the access SVI. Most endpoint identity resolves from a single DHCP discover — far more reliable than NMAP scans.` }
      ]
    },
    {
      id: 'posture',
      icon: '✅',
      title: 'Posture',
      tagline: 'Compliance checks before granting full access.',
      sections: [
        { kind: 'prose', html: `<p>Posture lets ISE verify that an endpoint meets compliance rules — AV up to date, disk encrypted, OS patched, registry value present — <i>before</i> giving full network access. Architecture: AnyConnect/Cisco Secure Client posture module talks to the PSN, runs the configured checks, and reports the result. ISE flips the session to a compliant SGT/dACL via Change-of-Authorization (CoA).</p>` },
        { kind: 'table', title: 'Posture flow',
          headers: ['Stage', 'Result', 'CoA'],
          rows: [
            ['Pre-posture', 'Limited dACL — DHCP/DNS/posture-server only', '—'],
            ['Posture probe', 'Agent reports compliance', '—'],
            ['Compliant', 'Full dACL/SGT applied', 'CoA Reauth'],
            ['Non-compliant', 'Quarantine VLAN/dACL + remediation URL', 'CoA Reauth']
          ]
        },
        { kind: 'callout', level: 'warn', title: 'Posture without CoA is broken',
          body: `RADIUS Change-of-Authorization is what flips the session after posture passes. CoA must be allowed end-to-end (UDP/1700 or 3799) from PSN to NAD. Test it explicitly.` }
      ]
    },
    {
      id: 'byod',
      icon: '📱',
      title: 'BYOD & EAP-TLS',
      tagline: 'Onboarding flow, internal CA, certificate templates.',
      sections: [
        { kind: 'prose', html: `<p>BYOD enrolls a personal device with a unique certificate so it can do EAP-TLS thereafter — no shared password reuse risk. The user lands on the BYOD portal, ISE issues a certificate via its <b>internal CA</b> (or proxies to an external one), and pushes the network profile.</p><p>EAP-TLS is the gold standard for wireless authentication: mutual cert-based auth, no passwords on the wire, immune to credential phishing. SCEP is the typical enrollment protocol from device to ISE CA.</p>` },
        { kind: 'callout', level: 'tip', title: 'Use the internal ISE CA',
          body: `For BYOD, the ISE internal CA is purpose-built — handles cert issuance, lifecycle, revocation. You only need an enterprise PKI if you're integrating with corporate-issued device certs as well.` }
      ]
    },
    {
      id: 'guest',
      icon: '🎟️',
      title: 'Guest Access',
      tagline: 'Hotspot, self-registration, sponsored, hot/cold portals.',
      sections: [
        { kind: 'prose', html: `<p>ISE ships four guest flows out of the box:</p><ul><li><b>Hotspot</b> — accept-AUP and you're on. No identity captured.</li><li><b>Self-registered</b> — guest fills a form, gets credentials by email/SMS.</li><li><b>Sponsored</b> — internal user creates the guest account.</li><li><b>BYOD-style</b> — for employees who prefer not to use 802.1X on personal devices.</li></ul><p>Each flow uses a <b>portal</b> (HTML+CSS theme on ISE) and a corresponding <b>portal authorization rule</b> that triggers the redirect.</p>` }
      ]
    },
    {
      id: 'trustsec',
      icon: '🏷️',
      title: 'TrustSec & SGTs',
      tagline: 'Group-based segmentation that travels with the user.',
      sections: [
        { kind: 'prose', html: `<p><b>TrustSec</b> tags every packet with a <b>Security Group Tag (SGT)</b> assigned at authentication. Egress devices (firewalls, switches with SGACL) match SGT-to-SGT pairs in a matrix — letting policy travel with the user instead of being pinned to subnets/VLANs.</p><p>Two propagation methods: <b>inline tagging</b> (Cisco-proprietary CMD header on the wire — needs supporting hardware) and <b>SXP</b> (Source-Group Tag eXchange — TCP-based, IP-to-SGT mappings shipped between devices).</p>` },
        { kind: 'cli', title: 'Switch — SXP peer to ISE',
          code: `cts sxp enable
cts sxp connection peer 10.10.10.50 password default mode local listener
cts role-based enforcement
cts role-based enforcement vlan-list 10-20

show cts sxp connections
show cts role-based permissions
show cts role-based counters`
        },
        { kind: 'callout', level: 'tip', title: 'Where TrustSec earns its keep',
          body: 'Lateral-movement prevention. Your "Finance" SGT can be denied from talking to "HR" SGT enterprise-wide with a single matrix cell — without rebuilding VLANs or ACLs on every switch.' }
      ]
    },
    {
      id: 'tacacs',
      icon: '🔑',
      title: 'TACACS+ for Device Admin',
      tagline: 'Per-command authorization, audit, role-based access.',
      sections: [
        { kind: 'prose', html: `<p>TACACS+ on ISE replaces ACS for network-device administration. Per-command authorization, full command accounting, AD-group-based shell profiles. Run on dedicated PSNs that have <b>Device Admin</b> service enabled (separate licence).</p>` },
        { kind: 'cli', title: 'Cisco IOS — TACACS+ to ISE',
          code: `aaa new-model
aaa authentication login default group ISE-TAC local
aaa authorization config-commands
aaa authorization commands 1 default group ISE-TAC local
aaa authorization commands 15 default group ISE-TAC local
aaa accounting commands 1 default start-stop group ISE-TAC
aaa accounting commands 15 default start-stop group ISE-TAC

tacacs server ISE-T1
 address ipv4 10.10.10.50
 key 7 <encrypted>
 single-connection
 timeout 5

aaa group server tacacs+ ISE-TAC
 server name ISE-T1`,
          desc: 'single-connection (TACACS+ multiplexing) is supported on ISE — keeps a single TCP session for all auth/authz/acct, much lower latency than per-request reconnect.' }
      ]
    },
    {
      id: 'integrations',
      icon: '🔌',
      title: 'Integrations & pxGrid',
      tagline: 'AD/LDAP, MDM, SIEM, FTD, Stealthwatch.',
      sections: [
        { kind: 'prose', html: `<p>ISE is most powerful when context flows out of it. <b>pxGrid</b> is a publish/subscribe bus — FTD subscribes to session/SGT info, Stealthwatch subscribes to identity, third-party SIEMs subscribe to ANC quarantine events. Mutual cert auth required.</p>` },
        { kind: 'table', title: 'Common integrations',
          headers: ['Integration', 'Purpose', 'Mechanism'],
          rows: [
            ['Active Directory', 'User auth, group lookup, machine auth', 'Native join (Kerberos)'],
            ['Azure AD / Entra', 'Cloud user auth via SAML/OIDC', 'Identity Source: SAML'],
            ['MDM (Intune, Workspace ONE, MaaS360)', 'Compliance check before access', 'MDM REST API'],
            ['Cisco FMC / FTD', 'Identity-based firewall rules', 'pxGrid'],
            ['Stealthwatch', 'Identity overlay on flow telemetry', 'pxGrid'],
            ['SIEM (Splunk, QRadar)', 'Auth + posture events', 'Syslog or pxGrid'],
            ['ServiceNow', 'Auto-ticket on quarantine', 'pxGrid + REST']
          ]
        }
      ]
    },
    {
      id: 'hardening',
      icon: '🛡️',
      title: 'ISE Hardening & Operations',
      tagline: 'Certificates, backups, patches, role separation.',
      sections: [
        { kind: 'prose', html: `<p>Operational checklist for a production ISE deployment:</p>` },
        { kind: 'checklist', title: 'Production hardening',
          items: [
            'EAP and admin certificates from a public/enterprise CA — never long-lived self-signed',
            'Schedule scheduled backups to a remote SFTP repository; verify a restore at least annually',
            'Patch cadence — apply ISE patches on the secondary PAN, promote, then patch the primary',
            'Separate Admin and Network Admin roles — no shared accounts',
            'Endpoint purge policy configured (auto-clean stale endpoints monthly)',
            'pxGrid certificate rotation tested',
            'ANC (Adaptive Network Control) quarantine policy ready and tested before incident',
            'Live logs retention — confirm MNT disk + scheduled archive to external storage',
            'Network device groups defined by location/role for scalable policy',
            'Disable insecure protocols — PAP, MS-CHAPv1, EAP-MD5'
          ]
        }
      ]
    },
    {
      id: 'troubleshooting',
      icon: '🩺',
      title: 'Troubleshooting',
      tagline: 'Live logs, RADIUS sniffing, common failure modes.',
      sections: [
        { kind: 'prose', html: `<p>The fastest path to a fix: <b>Operations → RADIUS → Live Logs</b> on the PAN. Every Access-Request shows up here with the matched authentication + authorization rule and the result. Click into a record for the full attribute dump.</p>` },
        { kind: 'cli', title: 'CLI diagnostics from an ISE node',
          code: `# Linux-side traces (admin shell on the node)
show logging application ise-psc.log tail
show logging application prrt-server.log tail
show logging application acidentcaller.log tail

# Live RADIUS capture on PSN
tcpdump -i eth0 -nn -s0 -w /tmp/radius.pcap 'udp port 1812 or udp port 1813 or udp port 1700 or udp port 3799'

# Application status
show application status ise
application restart ise

# AD diagnostics
show ad agent status
test active-directory user CORP\\\\jdoe`
        },
        { kind: 'checklist', title: 'Auth-failure triage',
          items: [
            'Live logs — does the request reach ISE at all? If not, NAD-side problem (shared secret, source IP, reachability).',
            'Failure reason in the live-log detail — protocol mismatch, identity-store unavailable, AD bind failure?',
            'Allowed Protocols set permits the EAP method the supplicant negotiated?',
            'Identity store: AD agent connectivity, replication, time-sync (Kerberos is unforgiving)?',
            'Authorization rule order — is a more permissive earlier rule matching first?',
            'CoA: Dynamic Authorization Client (DAC) configured on the NAD, UDP/1700 reachable?',
            'Posture: agent installed and reachable to PSN over the limited dACL?',
            'Certificates valid, trust chain present on both ISE and supplicant?'
          ]
        }
      ]
    }
  ]
};
