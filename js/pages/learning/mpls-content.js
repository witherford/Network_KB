// MPLS learning curriculum.

export const CURRICULUM = {
  id: 'mpls',
  title: 'MPLS',
  tagline: 'Multiprotocol Label Switching — LDP, L3VPN, traffic engineering, Segment Routing.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 270,
  modules: [
    {
      id: 'overview',
      title: 'Overview — Labels, FEC, LSRs',
      tagline: 'How MPLS puts a shim between L2 and L3, and why operators love it.',
      icon: '🏷️',
      sections: [
        { kind: 'prose', html: `
          <p><b>MPLS</b> inserts a 32-bit <b>label stack</b> between the L2 header and the L3 packet. Forwarding inside an MPLS domain is by <b>label</b>, not by destination IP — the <b>Label Switching Router (LSR)</b> swaps the incoming label for an outgoing label at every hop, without inspecting the payload. This decouples the <b>control plane</b> (routing protocols that compute paths) from the <b>forwarding plane</b> (label swaps).</p>
          <p>Key terms:</p>
          <ul>
            <li><b>LSR</b> — any router that swaps labels.</li>
            <li><b>LER</b> (or PE) — Label Edge Router. Imposes the label at ingress, pops it at egress.</li>
            <li><b>FEC</b> — Forwarding Equivalence Class. Packets that share the same forwarding treatment (e.g. "all packets for prefix 10.1.0.0/16").</li>
            <li><b>LSP</b> — Label Switched Path. The sequence of hops a labelled packet traverses for a given FEC.</li>
          </ul>` },
        { kind: 'diagram', title: 'MPLS label header (shim)', ascii:
`  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |               Label (20 bits)                 | TC  |S|  TTL  |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   TC  = Traffic Class (3 bits; formerly EXP)
   S   = Bottom of Stack
   TTL = 8 bits, independent of IP TTL` },
        { kind: 'callout', level: 'info', title: 'PHP — Penultimate Hop Popping', body: `By default, the LSR one hop before the egress LER pops the label so the egress router receives a plain IP packet. This saves the egress from a redundant L3 lookup after a label pop. Most platforms signal PHP by advertising <b>implicit-null</b> (label 3) in LDP — you will see this in <code>show mpls ldp bindings</code>.` },
      ],
    },

    {
      id: 'label-distribution',
      title: 'Label Distribution — LDP',
      tagline: 'How routers agree on labels for each FEC.',
      icon: '📡',
      sections: [
        { kind: 'prose', html: `
          <p>The forwarding plane needs a label for every FEC. Routers discover each other and exchange label bindings via a <b>Label Distribution Protocol</b>. Three flavours exist: <b>LDP</b> (RFC 5036 — by far the most common), <b>RSVP-TE</b> (for traffic-engineered LSPs), and <b>Segment Routing</b> (no signalling — IGP carries labels).</p>
          <p>LDP operation:</p>
          <ol>
            <li>Discovery: Hellos on UDP/646 (link) or UDP/646 to target (targeted LDP).</li>
            <li>Session: TCP/646 between neighbor LSR-IDs (typically loopbacks).</li>
            <li>Advertise: every LSR advertises a label for every IGP prefix it can reach (unsolicited downstream).</li>
            <li>Forwarding: install the mapping into the <b>LFIB</b>.</li>
          </ol>` },
        { kind: 'cli', title: 'Enable MPLS + LDP', code:
`mpls label protocol ldp
mpls ldp router-id Loopback0 force
!
interface GigabitEthernet0/0/0
 ip address 10.0.12.1 255.255.255.0
 mpls ip
!
! Verify
show mpls ldp neighbor
show mpls ldp bindings
show mpls forwarding-table
show mpls interfaces` },
        { kind: 'callout', level: 'warn', title: 'LDP-IGP synchronization', body: `If LDP comes up slower than the IGP after a link event, traffic black-holes because the IP path is ready but the label path is not. Enable <code>mpls ldp sync</code> (on IOS-XE) or equivalent on every MPLS-enabled interface — the IGP advertises a max metric on that link until LDP is ready.` },
      ],
    },

    {
      id: 'forwarding',
      title: 'Forwarding & the LFIB',
      tagline: 'What happens to a packet as it crosses the MPLS core.',
      icon: '🔀',
      sections: [
        { kind: 'diagram', title: 'Push / Swap / Pop', ascii:
`   CE ---IP--- PE1 --- P1 --- P2 --- PE2 ---IP--- CE
               ^       ^       ^      ^
               push    swap    swap   pop (or PHP at P2)
              label A  A→B    B→C     → plain IP

  PE1 "imposes" the label (push).
  Each P router reads the top label, looks it up in LFIB, swaps to the next label.
  PHP: P2 pops so PE2 sees native IP.` },
        { kind: 'cli', title: 'Inspect the LFIB', code:
`show mpls forwarding-table
show mpls forwarding-table 10.0.0.4/32 detail
show ip cef 10.0.0.4 detail
show mpls ldp bindings 10.0.0.4/32 32      ! who advertised which label?` },
        { kind: 'callout', level: 'tip', title: 'MPLS uses two label lookups for VPN traffic', body: `An L3VPN packet carries a stack of two labels: the outer <b>transport</b> label (IGP next-hop to the egress PE) and the inner <b>VPN</b> label (identifies which VRF). P routers only look at the outer label; the egress PE pops to see the inner VPN label and selects the VRF. That is the whole L3VPN forwarding trick.` },
      ],
    },

    {
      id: 'l3vpn',
      title: 'MPLS L3VPN — VRFs, RD, RT',
      tagline: 'Separating customer routing tables and carrying them end-to-end with MP-BGP.',
      icon: '🧩',
      sections: [
        { kind: 'prose', html: `
          <p><b>MPLS L3VPN</b> (RFC 4364) is the de-facto standard for service-provider VPNs and large enterprise segmentation. Each customer gets a <b>VRF</b> (Virtual Routing and Forwarding instance) — an isolated routing table. PE routers advertise customer prefixes to each other as <b>VPNv4</b> routes over MP-BGP; P routers never see customer prefixes at all.</p>
          <p>Two extended communities decouple the identity of a VRF from its membership:</p>
          <ul>
            <li><b>RD (Route Distinguisher)</b> — 8 bytes prepended to the customer prefix to make it globally unique in BGP.</li>
            <li><b>RT (Route Target)</b> — extended community that tags a route with which VRFs can import it. Imports and exports are independent — hub-and-spoke is an RT trick.</li>
          </ul>` },
        { kind: 'cli', title: 'PE-side L3VPN', code:
`vrf definition CUST-A
 rd 64500:100
 route-target export 64500:100
 route-target import 64500:100
 address-family ipv4
 exit-address-family
!
interface GigabitEthernet0/0/1
 vrf forwarding CUST-A
 ip address 192.168.1.1 255.255.255.252
!
router bgp 64500
 neighbor 10.0.0.2 remote-as 64500
 neighbor 10.0.0.2 update-source Loopback0
 !
 address-family vpnv4
  neighbor 10.0.0.2 activate
  neighbor 10.0.0.2 send-community extended
 exit-address-family
 !
 address-family ipv4 vrf CUST-A
  redistribute connected
  neighbor 192.168.1.2 remote-as 64600
  neighbor 192.168.1.2 activate
 exit-address-family` },
        { kind: 'callout', level: 'tip', title: 'RD uniqueness vs route-target policy', body: `A common misconception: RDs do not control route import. Only the <b>RT</b> matters for import/export. Use a consistent RD scheme (<code>ASN:customer-id</code>) for operational clarity, and use RT to compose topologies: hub-and-spoke (asymmetric RT), extranet (shared RT between customers), central services, etc.` },
      ],
    },

    {
      id: 'l2vpn',
      title: 'L2VPN — AToM, VPLS, EVPN',
      tagline: 'Carrying Ethernet, frame relay, ATM, PPP over MPLS pseudowires.',
      icon: '🧬',
      sections: [
        { kind: 'prose', html: `
          <p>Sometimes the customer needs layer 2 transport — the SP carries frames, not packets. MPLS supports several L2VPN modes:</p>
          <ul>
            <li><b>AToM</b> (Any Transport over MPLS) — point-to-point pseudowire between two PEs. Single VLAN or port-based. Signalled with LDP.</li>
            <li><b>VPLS</b> (RFC 4761/4762) — multipoint L2VPN that emulates a switch. Flooding, MAC learning, pseudowire full-mesh.</li>
            <li><b>EVPN</b> (RFC 7432) — modern replacement for VPLS. MP-BGP control plane, advertises MAC and IP bindings, supports active/active multihoming and integrated routing/bridging.</li>
          </ul>` },
        { kind: 'cli', title: 'Simple AToM xconnect', code:
`interface GigabitEthernet0/0/1
 description Customer A port
 no ip address
 xconnect 10.0.0.2 100 encapsulation mpls
!
! On the far end
interface GigabitEthernet0/0/1
 no ip address
 xconnect 10.0.0.1 100 encapsulation mpls
!
! Verify
show xconnect all
show mpls l2transport vc detail` },
        { kind: 'callout', level: 'tip', title: 'EVPN is replacing VPLS', body: `VPLS relies on flood-and-learn, suffers from slow convergence, and struggles with all-active multihoming. EVPN fixes all three using a BGP control plane — MACs are advertised, not flooded; MAC mobility is explicit; multihoming uses ESI and per-EVI Ethernet Segment routes. New deployments should be EVPN.` },
      ],
    },

    {
      id: 'te',
      title: 'Traffic Engineering with RSVP-TE',
      tagline: 'Explicit paths, bandwidth constraints, and FRR for sub-50ms failover.',
      icon: '🎯',
      sections: [
        { kind: 'prose', html: `
          <p><b>MPLS-TE</b> uses <b>RSVP-TE</b> (RFC 3209) to signal explicit LSPs across the core with bandwidth reservations and constraints (affinity, hop limit, administrative weight). Combined with <b>CSPF</b> (Constrained SPF) running on the head-end router, you can steer specific flows onto specific paths, reserve capacity, and compute backup paths for <b>Fast Reroute (FRR)</b>.</p>` },
        { kind: 'cli', title: 'IOS-XR TE tunnel (concise)', code:
`interface tunnel-te1
 ipv4 unnumbered Loopback0
 signalled-bandwidth 1000000      ! kbps
 destination 10.0.0.4
 autoroute announce
 path-option 10 dynamic
 fast-reroute
!
mpls traffic-eng
 interface GigabitEthernet0/0/0/0
 !
!
router ospf 1
 mpls traffic-eng router-id Loopback0
 area 0
  mpls traffic-eng` },
        { kind: 'callout', level: 'tip', title: 'FRR = 50ms protection', body: `FRR pre-computes a bypass tunnel around every protected link or node. On failure, the PLR (Point of Local Repair) pushes an extra label and switches traffic to the bypass immediately — typically under 50ms. No control-plane signalling required at failover time; RSVP renegotiates afterward.` },
      ],
    },

    {
      id: 'segment-routing',
      title: 'Segment Routing (SR-MPLS)',
      tagline: 'Source routing without LDP or RSVP — IGP carries labels directly.',
      icon: '➡️',
      sections: [
        { kind: 'prose', html: `
          <p><b>Segment Routing</b> eliminates LDP and RSVP-TE for most use cases. The IGP (OSPF or IS-IS) carries <b>segment identifiers (SIDs)</b> — 32-bit numbers that the data plane maps to MPLS labels. A router source-routes a packet by pushing a stack of SIDs; each hop pops or swaps based on its SID table.</p>
          <p>Two main SID types:</p>
          <ul>
            <li><b>Prefix-SID</b> — globally unique identifier for a destination prefix (usually a loopback).</li>
            <li><b>Adjacency-SID</b> — local identifier for a specific adjacency, used for strict-path source routing.</li>
          </ul>` },
        { kind: 'cli', title: 'IS-IS with Segment Routing', code:
`router isis CORE
 address-family ipv4 unicast
  metric-style wide
  segment-routing mpls
  segment-routing global-block 16000 23999
!
interface Loopback0
 ip router isis CORE
 isis prefix-sid index 100       ! SID = 16000 + 100 = 16100` },
        { kind: 'callout', level: 'tip', title: 'SR eliminates protocol sprawl', body: `Running OSPF + LDP + RSVP-TE means three control planes to monitor. Segment Routing collapses this to just the IGP. TE is handled by pushing an explicit SID stack from the head-end (SR-TE). MPLS L3VPN still uses MP-BGP — but for transport, SR-MPLS is the modern baseline.` },
      ],
    },

    {
      id: 'qos',
      title: 'MPLS QoS',
      tagline: 'Traffic Class (EXP) bits and the Uniform vs Pipe vs Short-pipe models.',
      icon: '🎚️',
      sections: [
        { kind: 'prose', html: `
          <p>The 3-bit <b>Traffic Class</b> field in the MPLS header (formerly called EXP) carries the DiffServ marking through the MPLS cloud. Three models define how IP DSCP and TC interact:</p>
          <ul>
            <li><b>Uniform</b> — TC is copied from DSCP at ingress and back to DSCP at egress. Core can remark.</li>
            <li><b>Pipe</b> — TC is set by the SP at ingress; original DSCP is preserved and restored at egress. Core uses TC.</li>
            <li><b>Short-pipe</b> — Pipe variant where egress PE uses the <em>customer</em> DSCP, not the core TC, for egress queueing.</li>
          </ul>` },
        { kind: 'cli', title: 'Set TC via policy-map', code:
`class-map match-any VOICE
 match dscp ef
!
policy-map INGRESS-QOS
 class VOICE
  set mpls experimental topmost 5
!
interface GigabitEthernet0/0/1
 service-policy input INGRESS-QOS` },
      ],
    },

    {
      id: 'inter-as',
      title: 'Inter-AS & CSC',
      tagline: 'Options A, B, C and how service providers interconnect VPN services.',
      icon: '🌉',
      sections: [
        { kind: 'table', title: 'Inter-AS L3VPN options (RFC 4364)', headers: ['Option','Mechanism','Complexity','Best for'], rows: [
          ['A','Back-to-back VRFs — EBGP in VRF across peering link','Low','Few VPNs, test / lab'],
          ['B','MP-eBGP VPNv4 between ASBRs, labels swapped at border','Medium','Multi-tenant SP-SP interconnect'],
          ['C','Multi-hop MP-eBGP between RRs; labels advertised over AS boundary','High','Large-scale wholesale VPN'],
        ]},
        { kind: 'callout', level: 'tip', title: 'CSC — Carrier Supporting Carrier', body: `CSC lets a "customer carrier" lease MPLS transport from a "backbone carrier". The backbone runs a normal L3VPN, but the customer carrier's PEs use that VPN as their underlay — pushing labels to reach each other through an unrelated operator's core. Used heavily in wholesale transit.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'LSP verification, VPN label inspection, and the go-to commands.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'MPLS OAM and diagnostics', code:
`! LSP ping / traceroute
ping mpls ipv4 10.0.0.4/32
trace mpls ipv4 10.0.0.4/32

! VPN label check
show bgp vpnv4 unicast all labels
show ip bgp vpnv4 vrf CUST-A 192.168.1.0

! LFIB and LDP
show mpls forwarding-table
show mpls ldp bindings
show mpls ldp neighbor

! CEF — does IP use MPLS for this path?
show ip cef 10.0.0.4 detail

! VRF routing
show ip route vrf CUST-A
show ip vrf detail CUST-A` },
        { kind: 'table', title: 'Common symptoms', headers: ['Symptom','Likely cause'], rows: [
          ['VPN traffic drops across the core','Transport label OK but VPN label missing — check MP-BGP VPNv4 neighbor'],
          ['LDP neighbor does not come up','Loopback not reachable; router-id not advertised in IGP'],
          ['After link flap, blackholes for 30s','No ldp sync configured — IGP ready before LDP'],
          ['Core P router sees customer prefixes','Misconfig — redistribute into global or bad BGP policy'],
          ['Inter-AS Option B: traffic fails on ASBR','Inter-AS label swap broken; verify ASBR labels via CEF'],
        ]},
      ],
    },
  ],
};
