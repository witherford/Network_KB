// Cisco Nexus VXLAN-EVPN learning centre.
export const CURRICULUM = {
  id: 'nexus-vxlan',
  title: 'Cisco Nexus VXLAN-EVPN',
  tagline: 'Fabric underlay & overlay, VTEPs, BGP EVPN, anycast gateway, multi-site.',
  estimatedMinutes: 280,
  modules: [
    {
      id: 'overview',
      icon: '🕸️',
      title: 'Overview & Why VXLAN-EVPN',
      tagline: 'The problem with VLANs at scale; VXLAN solves it; EVPN is the control plane.',
      sections: [
        { kind: 'prose', html: `<p>Traditional Layer-2 fabrics hit hard limits: 4,096 VLANs, spanning-tree black-holes, MAC-table churn at scale. <b>VXLAN</b> tunnels Ethernet inside UDP — giving you 16M segments (VNIs) that ride a routed underlay, so STP is gone and the underlay can use ECMP.</p><p>Early VXLAN used <b>flood-and-learn</b> (multicast underlay or ingress replication) to discover MACs. Modern fabrics use <b>BGP EVPN</b> as the control plane: VTEPs advertise MACs, IPs, and prefixes via MP-BGP — no flooding for unicast learning, faster convergence, and clean multi-tenancy via L3VNI/L2VNI.</p>` },
        { kind: 'diagram', title: 'Fabric anatomy',
          ascii: `         Spine 1                  Spine 2
        /   |   \\               /   |   \\
   Leaf1   Leaf2  Leaf3      Leaf1  Leaf2  Leaf3
   (VTEP)  (VTEP) (VTEP)
     |       |      |
   Hosts   Hosts  Hosts

  Underlay: routed (OSPF or eBGP) + ECMP — every leaf has /32 loopback (NVE source IP)
  Overlay : VXLAN encap between VTEPs, control plane = BGP EVPN (AF L2VPN EVPN)` },
        { kind: 'table', title: 'Plane responsibilities',
          headers: ['Plane', 'Job', 'Protocol(s)'],
          rows: [
            ['Underlay', 'Loopback reachability + ECMP between leaves & spines', 'OSPF or eBGP, optional PIM if multicast underlay'],
            ['Overlay (control)', 'Advertise MAC, MAC+IP, prefixes between VTEPs', 'MP-BGP EVPN (RFC 7432, 8365)'],
            ['Overlay (data)', 'Encapsulate tenant traffic in VXLAN', 'VXLAN UDP/4789']
          ]
        },
        { kind: 'callout', level: 'tip', title: 'Anchor concept',
          body: 'Loopback0 of each VTEP is the heartbeat. NVE source = lo0, BGP peering = lo0, every EVPN advertisement carries lo0 as next-hop. Get loopback reachability right and 80% of fabric problems disappear.' }
      ]
    },
    {
      id: 'underlay',
      icon: '🛣️',
      title: 'Underlay Design',
      tagline: 'OSPF vs eBGP, MTU, point-to-point, BFD, ECMP.',
      sections: [
        { kind: 'prose', html: `<p>The underlay has one job: get every leaf loopback to every spine loopback over equal-cost paths. Two common choices:</p><ul><li><b>OSPF area 0</b> — simple, fast convergence, single AS. Best for small/medium fabrics.</li><li><b>eBGP per-link</b> — each leaf is its own AS, each spine its own AS. Scales to thousands of leaves, multi-vendor friendly, gives operators full path-attribute control.</li></ul><p>Either way: point-to-point /31 (or /30) on the leaf-spine links, MTU 9216 (VXLAN adds 50 bytes — never use 1500), BFD on every link for sub-second failure detection.</p>` },
        { kind: 'cli', title: 'NX-OS — OSPF underlay (leaf)',
          code: `feature ospf
feature interface-vlan
feature bfd

interface loopback0
  ip address 10.255.255.11/32
  ip router ospf UNDERLAY area 0.0.0.0

interface Ethernet1/49
  description leaf-to-spine1
  no switchport
  mtu 9216
  ip address 10.0.0.1/31
  ip router ospf UNDERLAY area 0.0.0.0
  ip ospf network point-to-point
  bfd interval 250 min_rx 250 multiplier 3
  no shutdown

router ospf UNDERLAY
  router-id 10.255.255.11
  bfd
  log-adjacency-changes detail`,
          desc: 'Always set "ip ospf network point-to-point" on leaf-spine links — without it, OSPF assumes broadcast and adds a DR election that wastes adjacency time.' },
        { kind: 'cli', title: 'NX-OS — eBGP underlay (leaf)',
          code: `feature bgp
feature bfd

interface loopback0
  ip address 10.255.255.11/32

interface Ethernet1/49
  no switchport
  mtu 9216
  ip address 10.0.0.1/31
  no shutdown

router bgp 65011
  router-id 10.255.255.11
  log-neighbor-changes
  bfd
  address-family ipv4 unicast
    network 10.255.255.11/32
    maximum-paths 64
  template peer SPINE
    remote-as external
    bfd
    update-source Ethernet1/49
    address-family ipv4 unicast
      send-community both
      allowas-in 1
  neighbor 10.0.0.0
    inherit peer SPINE`,
          desc: 'allowas-in 1 lets a leaf accept a route whose AS-path already contains its own AS — needed when spines are all in the same AS. maximum-paths 64 enables ECMP across all spine uplinks.' },
        { kind: 'callout', level: 'warn', title: 'MTU is the silent killer',
          body: 'VXLAN encap adds 50 bytes. If even one underlay link is at MTU 1500, large overlay flows get black-holed silently — TCP just retransmits and stalls. Set 9216 fabric-wide and verify with ping df-bit size 8000 between loopbacks.' }
      ]
    },
    {
      id: 'vtep-nve',
      icon: '🚪',
      title: 'VTEP & NVE Configuration',
      tagline: 'NVE interface, source loopback, ingress-replication vs multicast.',
      sections: [
        { kind: 'prose', html: `<p>A <b>VTEP</b> (VXLAN Tunnel Endpoint) is the encap/decap point — usually a leaf switch. Configuration is anchored on the <b>NVE</b> (Network Virtualisation Edge) interface, which references a loopback as its source IP.</p><p>For BUM (broadcast/unknown-unicast/multicast) replication you have two choices: <b>multicast</b> (PIM in the underlay, every VNI mapped to a group — efficient at scale) or <b>ingress replication</b> (the VTEP sends N unicast copies, no multicast required — simpler but bandwidth-heavy).</p>` },
        { kind: 'cli', title: 'NX-OS — NVE & VLAN-to-VNI mapping',
          code: `feature nv overlay
feature vn-segment-vlan-based

! VLAN to L2VNI mapping
vlan 100
  name TENANT_WEB
  vn-segment 10100
vlan 200
  name TENANT_DB
  vn-segment 10200

! L3VNI for tenant routing (one per VRF)
vlan 999
  name L3VNI_TENANT_A
  vn-segment 50001

! Tenant SVI
interface Vlan100
  no shutdown
  vrf member TENANT_A
  ip address 10.1.100.1/24
  fabric forwarding mode anycast-gateway

! NVE interface
interface nve1
  no shutdown
  host-reachability protocol bgp
  source-interface loopback0
  member vni 10100
    suppress-arp
    ingress-replication protocol bgp
  member vni 10200
    suppress-arp
    ingress-replication protocol bgp
  member vni 50001 associate-vrf`,
          desc: 'host-reachability protocol bgp = use BGP EVPN, not flood-and-learn. associate-vrf marks an L3VNI used for inter-subnet routing, not L2 bridging.' },
        { kind: 'cli', title: 'Verify the VTEP',
          code: `show nve interface nve1 detail
show nve peers
show nve vni              ! per-VNI state, ingress-replication peers
show ip route             ! confirm spine loopbacks reachable
show interface nve1 counters  ! encap/decap stats`
        },
        { kind: 'table', title: 'BUM replication choice',
          headers: ['Mode', 'Underlay needs', 'Pros', 'Cons'],
          rows: [
            ['Multicast', 'PIM (sparse or BiDir) + RP', 'Efficient — one copy per branch', 'PIM + RP design adds complexity'],
            ['Ingress replication (BGP EVPN type-3)', 'Just IP', 'No multicast in underlay', 'Each BUM frame N-replicated by ingress VTEP']
          ]
        }
      ]
    },
    {
      id: 'evpn-cp',
      icon: '📨',
      title: 'BGP EVPN Control Plane',
      tagline: 'AF L2VPN EVPN, route types 1–5, RTs and RDs.',
      sections: [
        { kind: 'prose', html: `<p>EVPN piggybacks on MP-BGP. Each VTEP peers with a route-reflector (typically the spines) under address-family <code>l2vpn evpn</code>. Five route types do all the work:</p><ul><li><b>Type-1 (Ethernet A-D)</b> — multi-homing / fast aliasing.</li><li><b>Type-2 (MAC/IP)</b> — the workhorse: advertises learned MACs and host IPs.</li><li><b>Type-3 (Inclusive Multicast)</b> — peer discovery for BUM (ingress replication list).</li><li><b>Type-4 (ES route)</b> — multi-homing DF election.</li><li><b>Type-5 (IP prefix)</b> — external routes, summary prefixes, redistribution from underlay or other VRFs.</li></ul>` },
        { kind: 'cli', title: 'NX-OS — BGP EVPN session (leaf)',
          code: `router bgp 65011
  router-id 10.255.255.11
  address-family l2vpn evpn
    advertise-pip
  neighbor 10.255.255.1
    remote-as 65000
    update-source loopback0
    ebgp-multihop 3
    address-family l2vpn evpn
      send-community both

! Per-tenant config
vrf context TENANT_A
  vni 50001
  rd auto
  address-family ipv4 unicast
    route-target both auto
    route-target both auto evpn

! Per-VNI on EVPN
evpn
  vni 10100 l2
    rd auto
    route-target import auto
    route-target export auto`,
          desc: 'rd auto and route-target auto build the RD/RT from the ASN + VNI — simple and consistent. advertise-pip ensures host routes carry the leaf primary IP, not the vPC virtual IP.' },
        { kind: 'callout', level: 'info', title: 'RD vs RT — the difference',
          body: `RD (route distinguisher) makes a route unique inside BGP — same prefix in two VRFs needs different RDs. RT (route target) is the import/export label: which routes belong to which VRF. RD says "who I am", RT says "who I share with".` },
        { kind: 'cli', title: 'Inspect EVPN routes',
          code: `show bgp l2vpn evpn summary
show bgp l2vpn evpn                     ! all routes
show bgp l2vpn evpn route-type 2        ! MAC/IP advertisements
show bgp l2vpn evpn vni-id 10100        ! per-VNI
show l2route evpn mac all
show l2route evpn mac-ip all`
        }
      ]
    },
    {
      id: 'anycast-gw',
      icon: '🎯',
      title: 'Distributed Anycast Gateway',
      tagline: 'Same gateway IP/MAC on every leaf — VM mobility without ARP retraining.',
      sections: [
        { kind: 'prose', html: `<p>Each tenant SVI on every leaf shares the <b>same IP and same MAC</b>. A host always ARPs its local leaf — when it moves, the new leaf already owns the gateway, so no gratuitous ARP, no traffic-tromboning to a centralised gateway.</p><p>Configured fabric-wide with <code>fabric forwarding anycast-gateway-mac</code>, then <code>fabric forwarding mode anycast-gateway</code> on each tenant SVI.</p>` },
        { kind: 'cli', title: 'Anycast gateway — fabric & SVI',
          code: `! Global (every leaf)
fabric forwarding anycast-gateway-mac 0001.0001.0001

! Tenant SVI (every leaf that hosts the VLAN)
interface Vlan100
  no shutdown
  vrf member TENANT_A
  ip address 10.1.100.1/24
  ipv6 address 2001:db8:100::1/64
  fabric forwarding mode anycast-gateway`,
          desc: 'Use the same anycast MAC on every leaf in the fabric. ARP suppression (set on the NVE per-VNI) further reduces flooding by answering ARPs locally from the EVPN MAC/IP cache.' },
        { kind: 'callout', level: 'tip', title: 'ARP suppression payoff',
          body: 'In a 100-leaf fabric an ARP from one host normally floods to all 100 VTEPs. With suppress-arp, the local leaf answers from its EVPN cache — broadcast traffic across the fabric drops by orders of magnitude.' }
      ]
    },
    {
      id: 'vrf-routing',
      icon: '🛤️',
      title: 'Tenant VRFs & L3VNI Routing',
      tagline: 'Symmetric IRB, route-leaking, external connectivity.',
      sections: [
        { kind: 'prose', html: `<p>Every tenant gets its own VRF. Inter-subnet traffic between tenant VLANs is routed at the ingress leaf, encapsulated with the <b>L3VNI</b>, and decap+routed at the egress leaf — this is <b>symmetric IRB</b> (Integrated Routing and Bridging). The egress VTEP doesn't need the source MAC/IP — only the destination VRF and prefix — which scales much better than asymmetric IRB.</p><p>For external connectivity (off-fabric), one or more leaves act as <b>border leaves</b>: they peer eBGP/OSPF with WAN routers and redistribute via type-5 routes back into the fabric.</p>` },
        { kind: 'cli', title: 'Tenant VRF + border leaf',
          code: `vrf context TENANT_A
  vni 50001
  rd auto
  address-family ipv4 unicast
    route-target both auto
    route-target both auto evpn

! Border leaf — peer external & redistribute as Type-5
router bgp 65011
  vrf TENANT_A
    address-family ipv4 unicast
      advertise l2vpn evpn
      redistribute direct route-map TENANT_A_DIRECT
    neighbor 192.0.2.1
      remote-as 65100
      address-family ipv4 unicast
        route-map ALLOW in
        route-map ALLOW out`,
          desc: '"advertise l2vpn evpn" within the VRF address-family is what turns IPv4 unicast routes into EVPN type-5 advertisements for the rest of the fabric.' }
      ]
    },
    {
      id: 'vpc-vxlan',
      icon: '🤝',
      title: 'vPC + VXLAN — Multi-homing',
      tagline: 'Anycast VTEP IP, peer-link, peer-keepalive, ES-EVI.',
      sections: [
        { kind: 'prose', html: `<p>Servers still want LACP across two leaves. With vPC, two leaves act as one logical switch — each leaf has its own loopback for fabric peering, and they share an <b>anycast VTEP IP</b> (a second loopback on both members) used as the NVE source. From the rest of the fabric, both vPC leaves look like a single VTEP.</p><p>Modern designs replace vPC with <b>EVPN multi-homing</b> (ES-EVI, type-1 Ethernet A-D and type-4 ES routes) — no peer-link, all-active forwarding, faster failure recovery.</p>` },
        { kind: 'cli', title: 'vPC + anycast VTEP',
          code: `feature vpc

vpc domain 1
  peer-switch
  peer-keepalive destination 10.99.99.12 source 10.99.99.11
  peer-gateway
  ip arp synchronize
  delay restore 150
  auto-recovery
  ipv6 nd synchronize

interface port-channel1
  description peer-link
  switchport mode trunk
  switchport trunk allowed vlan all
  spanning-tree port type network
  vpc peer-link

! Each leaf has its own loopback0 (BGP, OSPF, NVE control)
interface loopback0
  ip address 10.255.255.11/32

! Shared anycast VTEP IP (same on both vPC peers)
interface loopback1
  ip address 10.255.255.111/32

interface nve1
  source-interface loopback1
  host-reachability protocol bgp`,
          desc: 'BGP/OSPF use loopback0 (unique per leaf). NVE encap uses loopback1 (shared between vPC pair). The fabric only sees one VTEP IP from the pair.' }
      ]
    },
    {
      id: 'multi-site',
      icon: '🌍',
      title: 'Multi-Site & DCI',
      tagline: 'BGW (Border Gateway), inter-site VNIs, isolation domains.',
      sections: [
        { kind: 'prose', html: `<p>One fabric per DC scales to thousands of leaves, but stretching VNIs across DCs over WAN demands explicit boundaries. <b>Multi-Site</b> uses <b>Border Gateways (BGWs)</b> at each fabric edge that re-originate EVPN routes between sites and translate VNIs as needed. Each site keeps its own underlay, control plane, and BUM domain — failures don't cross the fence.</p>` },
        { kind: 'diagram', title: 'Multi-Site topology',
          ascii: `   Site A (fabric A)        WAN/IP        Site B (fabric B)
   Spine - Leaf - BGW  ---------------- BGW - Leaf - Spine
                  |                      |
               loopback             loopback (DCI underlay)
   EVPN re-originate at BGW; VNIs may be re-numbered per site` },
        { kind: 'cli', title: 'BGW essentials',
          code: `evpn multisite border-gateway 1
  delay-restore time 300

interface loopback100
  description DCI source
  ip address 100.100.100.1/32

interface nve1
  multisite border-gateway interface loopback100

router bgp 65000
  address-family l2vpn evpn
    rewrite-evpn-rt-asn`,
          desc: 'rewrite-evpn-rt-asn lets the BGW translate route-targets between AS numbers — essential when each site uses its own ASN.' },
        { kind: 'callout', level: 'info', title: 'When you actually need multi-site',
          body: 'For two adjacent DCs with dark fibre, a single stretched fabric is fine. Multi-Site earns its keep when sites are independently operated, have different AS numbers, or you need a hard blast-radius boundary on BUM and control-plane failures.' }
      ]
    },
    {
      id: 'security',
      icon: '🔒',
      title: 'Tenant Isolation & Security',
      tagline: 'VRFs, downstream-VNI, EVPN policy, microsegmentation.',
      sections: [
        { kind: 'prose', html: `<p>Hard isolation in EVPN comes from <b>VRFs</b> + per-VRF L3VNIs. Routes from one tenant cannot leak into another unless an explicit <b>route-target import</b> exists. Beyond that:</p><ul><li><b>Downstream-VNI</b> — different sites can use different VNIs for the "same" tenant, BGW translates.</li><li><b>EVPN route policy</b> — filter type-2/type-5 advertisements with route-maps for blast-radius control.</li><li><b>Microsegmentation</b> — TrustSec/SGT or VXLAN-Group-Based-Policy (GBP) carries security-group tags inside the VXLAN header for intra-tenant policy.</li></ul>` },
        { kind: 'callout', level: 'warn', title: 'Default RTs leak',
          body: 'route-target both auto applies the same RT for every VRF in your AS unless you scope it. Use explicit RTs (manual import/export) for any tenant that must remain truly isolated.' }
      ]
    },
    {
      id: 'ops-verify',
      icon: '🔧',
      title: 'Day-2 Operations & Verification',
      tagline: 'Show commands, expected output, BFD, telemetry.',
      sections: [
        { kind: 'cli', title: 'Top-10 verification commands',
          code: `show nve peers
show nve vni
show ip route vrf TENANT_A
show bgp l2vpn evpn summary
show bgp l2vpn evpn vni-id 10100
show mac address-table dynamic vlan 100
show l2route evpn mac all
show l2route evpn mac-ip all
show ip arp suppression-cache detail
show forwarding adjacency`
        },
        { kind: 'cli', title: 'BFD + telemetry',
          code: `show bfd neighbors
show bfd neighbors details

! Streaming telemetry (gNMI/gRPC)
feature telemetry
telemetry
  destination-group DG1
    ip address 10.50.50.50 port 57500 protocol gRPC encoding GPB
  sensor-group SG1
    data-source DME
    path "Cisco-NX-OS-device-yang:bgp-evpn"
  subscription 1
    dst-grp DG1
    snsr-grp SG1 sample-interval 30000`
        }
      ]
    },
    {
      id: 'troubleshooting',
      icon: '🩺',
      title: 'Troubleshooting',
      tagline: 'Black-holes, missing MACs, broken multi-homing, MTU, ECMP.',
      sections: [
        { kind: 'prose', html: `<p>Walk the layers in order:</p><ol><li>Underlay reachability — every leaf loopback must reach every spine + every other leaf loopback over ECMP.</li><li>NVE state — peers established, source IP correct, VNIs up.</li><li>BGP EVPN sessions — established with all spines, route counters non-zero.</li><li>Per-VNI routes — type-2 for known hosts, type-3 for ingress-replication peers.</li><li>MAC table on the local leaf — should show remote MACs as <code>NVE</code> with the remote VTEP as next-hop.</li><li>Encap on the wire — capture on a spine uplink, look for UDP/4789 with the right VNI.</li></ol>` },
        { kind: 'cli', title: 'Common fault checks',
          code: `! Underlay loopback ECMP
show ip route 10.255.255.21
ping 10.255.255.21 source 10.255.255.11 count 5

! NVE peer not coming up
show nve peers detail
show nve interface nve1 detail
show running-config nv overlay

! Missing remote MAC
show l2route evpn mac all                  ! local view
show bgp l2vpn evpn route-type 2 detail   ! BGP view
debug l2rib evpn-events                   ! sparingly

! ARP suppression not answering
show ip arp suppression-cache detail
show ip arp suppression-cache statistics

! MTU smoke test (df-bit, jumbo)
ping 10.255.255.21 size 8000 df-bit count 5 source loopback0`
        },
        { kind: 'checklist', title: 'Fabric outage triage',
          items: [
            'Underlay routing converged on every leaf? show ip route 10.255.255.0/24',
            'BFD up on every leaf-spine link?',
            'NVE peers visible on the affected leaves?',
            'BGP l2vpn evpn neighbours up + route counters non-zero?',
            'Anycast VTEP IP correct (vPC pairs share, others unique)?',
            'MTU 9216 on all transit links?',
            'route-target import/export consistent on the affected VRF?',
            'Multi-site BGW healthy + DCI underlay reachable?'
          ]
        }
      ]
    }
  ]
};
