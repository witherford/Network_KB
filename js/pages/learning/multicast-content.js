// IP Multicast learning curriculum.

export const CURRICULUM = {
  id: 'multicast',
  title: 'IP Multicast',
  tagline: 'IGMP/MLD, PIM SM/SSM/BIDIR, RP discovery, MSDP, mVPN, L2 snooping.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 220,
  modules: [
    {
      id: 'overview',
      title: 'Overview — Groups, Trees, RPF',
      tagline: 'Why multicast is not just "UDP to many hosts" and how trees avoid loops.',
      icon: '📡',
      sections: [
        { kind: 'prose', html: `
          <p><b>IP Multicast</b> delivers one sender's traffic to many receivers using a single network transmission per link — essential for financial market data, IPTV, sensor telemetry, and video production. Unlike unicast, there is no TCP: it is best-effort UDP. Unlike broadcast, only interested receivers get the traffic.</p>
          <p>Core concepts:</p>
          <ul>
            <li><b>Group</b> — an IPv4 address in <code>224.0.0.0/4</code> or IPv6 <code>ff00::/8</code> that identifies the "channel".</li>
            <li><b>Source tree (S,G)</b> — shortest-path tree from a specific source to all receivers.</li>
            <li><b>Shared tree (*,G)</b> — rooted at the RP (Rendezvous Point) for the group; used in PIM-SM as the initial join.</li>
            <li><b>RPF check</b> — Reverse Path Forwarding: router accepts the packet only if it arrived on the interface it would use to send <em>back</em> to the source. Prevents loops.</li>
          </ul>` },
        { kind: 'table', title: 'IPv4 multicast address ranges', headers: ['Range','Purpose','Example'], rows: [
          ['224.0.0.0/24','Link-local — never forwarded off-subnet','224.0.0.1 (all hosts), 224.0.0.5 (OSPF)'],
          ['224.0.1.0 – 238.255.255.255','Globally scoped','224.0.1.129 (NTP — deprecated)'],
          ['232.0.0.0/8','SSM — Source-Specific Multicast','232.1.1.1 (with specific source)'],
          ['233.252.0.0/14','GLOP (ASN-encoded)','233.0.0.0 + ASN-derived'],
          ['239.0.0.0/8','Admin-scoped (private)','239.1.1.1 (enterprise internal)'],
        ]},
        { kind: 'callout', level: 'info', title: 'MAC mapping — 5 high bits are lost', body: `IPv4 multicast maps to MAC prefix <code>01:00:5E</code> + lower 23 bits of the group address. The top 5 bits of the group are discarded — so <code>224.1.1.1</code>, <code>225.1.1.1</code>, <code>229.129.1.1</code> all share the same MAC. Picking admin-scoped groups with unique low-23 bits avoids L2 collisions in dense deployments.` },
      ],
    },

    {
      id: 'igmp-mld',
      title: 'IGMP (v1/v2/v3) & MLD',
      tagline: 'How hosts say "I want to receive this group".',
      icon: '✋',
      sections: [
        { kind: 'table', title: 'IGMP versions', headers: ['Version','Host leaves','Source-specific','Default on'], rows: [
          ['IGMPv1','No explicit leave','No','Legacy — avoid'],
          ['IGMPv2','Leave Group message','No','Common baseline'],
          ['IGMPv3','Include/Exclude source list','Yes (SSM)','Required for SSM'],
        ]},
        { kind: 'cli', title: 'IGMP basics on IOS-XE', code:
`interface Vlan 100
 ip address 10.100.0.1 255.255.255.0
 ip pim sparse-mode
 ip igmp version 3
 ip igmp query-interval 60
!
! Inspect
show ip igmp interface Vlan100
show ip igmp groups
show ip igmp snooping groups` },
        { kind: 'callout', level: 'tip', title: 'One querier per LAN — elected by lowest IP', body: `If multiple multicast routers share a LAN, the one with the lowest IP wins the IGMP querier role and sends General Queries. If the elected querier goes silent (shutdown, crash), there is a gap before the next one takes over. Static querier timers and redundant design (anycast on SVIs, first-hop redundancy) keep this tidy.` },
      ],
    },

    {
      id: 'pim-dense',
      title: 'PIM Dense Mode',
      tagline: 'Flood-and-prune. Historical — here is why not to use it.',
      icon: '🌳',
      sections: [
        { kind: 'prose', html: `
          <p><b>PIM-DM</b> assumes receivers are <em>everywhere</em>. It floods multicast across the whole network and prunes back branches that have no receivers. Every 3 minutes (by default), state ages out and it floods again. On any real network, this wastes bandwidth and CPU.</p>
          <p>Real-world usage is near zero. You will see it on exam tracks and on tiny lab networks. If you find it in production, it is almost certainly a mistake — migrate to PIM-SM with Auto-RP/BSR or PIM-SSM.</p>` },
        { kind: 'callout', level: 'warn', title: 'Do not enable ip pim dense-mode on interfaces', body: `A classic gotcha: <code>ip pim sparse-dense-mode</code> falls back to dense mode for groups without an RP. A forgotten application fires traffic to a group with no RP → the whole network floods → CPU spike and link saturation. Use <code>ip pim sparse-mode</code> everywhere and set a default RP.` },
      ],
    },

    {
      id: 'pim-sparse',
      title: 'PIM Sparse Mode & Rendezvous Points',
      tagline: 'The default IP multicast model: shared trees first, SPT switchover later.',
      icon: '🌲',
      sections: [
        { kind: 'prose', html: `
          <p><b>PIM-SM</b> assumes receivers are <em>sparse</em>. Nothing flows until a receiver joins. The flow:</p>
          <ol>
            <li>Receiver sends IGMP Report for group G → last-hop router creates (*,G) state.</li>
            <li>Last-hop router sends PIM Join up the RPF path toward the RP → builds shared tree (*,G) rooted at the RP.</li>
            <li>Source starts sending → first-hop router encapsulates traffic in PIM Register messages unicast to the RP.</li>
            <li>RP forwards decapsulated traffic down the shared tree to receivers.</li>
            <li>Last-hop router sees traffic arriving, learns source, sends (S,G) Join toward the source → SPT switchover.</li>
            <li>Last-hop router prunes (*,G) from the shared tree — future traffic takes the SPT directly.</li>
          </ol>` },
        { kind: 'diagram', title: 'PIM-SM flow', ascii:
`  Source S --- FHR --- P --- RP --- P --- LHR --- Receiver
                \\                       /
                 +-----(shared tree)----+
                          |
                          v  SPT switchover after first packet
                  LHR joins (S,G) along shortest path to S` },
        { kind: 'cli', title: 'PIM-SM with static RP', code:
`! Core routers
ip multicast-routing distributed
!
interface Loopback0
 ip address 10.0.0.1 255.255.255.255
 ip pim sparse-mode
!
interface GigabitEthernet0/0/0
 ip pim sparse-mode
!
! Define the RP (usually a loopback on a well-placed router)
ip pim rp-address 10.0.0.1 MCAST-GROUPS
ip access-list standard MCAST-GROUPS
 permit 239.0.0.0 0.255.255.255
!
! Verify
show ip pim interface
show ip pim rp mapping
show ip mroute
show ip mroute active` },
      ],
    },

    {
      id: 'ssm-bidir',
      title: 'PIM-SSM & BIDIR',
      tagline: 'When you know sources (SSM) or have many-to-many (BIDIR).',
      icon: '🔀',
      sections: [
        { kind: 'prose', html: `
          <p><b>PIM-SSM</b> (Source-Specific Multicast) is PIM-SM without the RP. The receiver must specify the source — IGMPv3 does this natively. The last-hop router sends (S,G) Join immediately; no shared tree, no RP. SSM is the right answer for <em>one-to-many</em> distribution when receivers know the source (financial data, IPTV delivery). The <code>232.0.0.0/8</code> range is SSM-only by default.</p>
          <p><b>PIM-BIDIR</b> builds a single shared bidirectional tree rooted at the RP for both sending and receiving. There is no SPT switchover and no (S,G) state — <em>huge</em> state reduction for many-to-many applications (collaborative video, trading floors). Trade-off: all traffic traverses the RP.</p>` },
        { kind: 'cli', title: 'SSM and BIDIR', code:
`! SSM — just enable the range and tell IGMP to honour IGMPv3
ip pim ssm default                     ! = 232.0.0.0/8
!
! Enterprise custom SSM range
ip pim ssm range SSM-RANGE
ip access-list standard SSM-RANGE
 permit 239.100.0.0 0.0.255.255
!
! BIDIR
ip pim rp-address 10.0.0.1 BIDIR-GROUPS bidir
ip access-list standard BIDIR-GROUPS
 permit 225.0.0.0 0.255.255.255` },
        { kind: 'callout', level: 'tip', title: 'SSM is the modern default for one-to-many', body: `If your receivers know the source IP (and most apps do), choose SSM. No RP means no RP failover to design, no Auto-RP/BSR, no Anycast-RP. The IGMPv3 include-source state flows directly up the SPT. For greenfield designs, start with SSM and only use ASM/BIDIR for specific legacy or many-to-many cases.` },
      ],
    },

    {
      id: 'rp-discovery',
      title: 'RP Discovery — Static, Auto-RP, BSR, Anycast-RP',
      tagline: 'How routers agree on the RP, and how to make RP failure not break everything.',
      icon: '🎯',
      sections: [
        { kind: 'table', title: 'RP discovery mechanisms', headers: ['Method','Announce protocol','Pros','Cons'], rows: [
          ['Static','Config','Simple, deterministic','No failover unless combined with Anycast'],
          ['Auto-RP','Cisco-proprietary','Automatic RP advertisement','Cisco-only; uses groups 224.0.1.39/40'],
          ['BSR (PIMv2)','Standards','Vendor-neutral','More complex than Auto-RP'],
          ['Anycast-RP (with MSDP)','Config + MSDP','Stateless failover; load sharing','Requires MSDP peering between RPs'],
          ['PIM Anycast-RP (RFC 4610)','PIM Register forwarding','No MSDP needed','Fewer vendors support it'],
        ]},
        { kind: 'cli', title: 'Anycast-RP with MSDP', code:
`! Both RP routers share the same loopback IP (10.0.0.254)
interface Loopback1
 ip address 10.0.0.254 255.255.255.255
 ip pim sparse-mode
!
! Also a unique loopback for MSDP
interface Loopback0
 ip address 10.0.0.1 255.255.255.255
!
ip pim rp-address 10.0.0.254
!
! MSDP peering to the OTHER RP
ip msdp peer 10.0.0.2 connect-source Loopback0
ip msdp originator-id Loopback0
!
! On the other RP: connect-source 10.0.0.2, peer 10.0.0.1` },
        { kind: 'callout', level: 'tip', title: 'Anycast-RP — two RPs, one RP address', body: `Both RPs advertise the same /32 via the IGP. Routers reach whichever is closer. If one fails, traffic shifts to the other automatically (within IGP convergence). MSDP keeps the two RPs in sync for sources — when one learns a new (S,G), it tells the other via an SA message.` },
      ],
    },

    {
      id: 'msdp',
      title: 'MSDP — Inter-Domain Multicast',
      tagline: 'Advertising active sources across RP boundaries.',
      icon: '🌉',
      sections: [
        { kind: 'prose', html: `
          <p><b>MSDP</b> (RFC 3618) lets RPs in different PIM domains share active-source information. When a source starts sending, its local RP advertises the (S,G) to MSDP peer RPs via Source-Active (SA) messages. Peer RPs then use that info to join the SPT directly (bypassing the shared tree entirely), which is why MSDP works well with SSM-like behaviour.</p>
          <p>MSDP was the mechanism behind the old multicast internet (MBONE) and is still the tool for inter-AS multicast. Inside an AS, MSDP is usually only seen paired with Anycast-RP.</p>` },
        { kind: 'callout', level: 'warn', title: 'MSDP SA-cache growth', body: `MSDP routers keep an SA cache of every active source across peered domains. At scale this can be enormous. Apply <code>ip msdp sa-filter</code> and <code>ip msdp redistribute</code> with access-lists to admit only the sources you actually want to advertise — default "advertise everything" is a bad idea across administrative boundaries.` },
      ],
    },

    {
      id: 'mvpn',
      title: 'Multicast VPN (mVPN)',
      tagline: 'Carrying multicast through an MPLS L3VPN with MDT trees.',
      icon: '🧩',
      sections: [
        { kind: 'prose', html: `
          <p><b>Multicast VPN</b> extends MPLS L3VPN with customer multicast. Two flavours:</p>
          <ul>
            <li><b>Draft-Rosen / PIM-based mVPN</b> — customer (C) multicast runs in a VRF; PE routers form a <b>Default MDT</b> (P-group) in the core that carries encapsulated customer multicast. Data MDTs spin up for high-rate groups. Simple but less efficient.</li>
            <li><b>Next-Gen mVPN (RFC 6513/6514)</b> — BGP control plane for multicast auto-discovery and tree signalling; P-tunnel can be P2MP MPLS-TE, mLDP, or ingress replication. The modern standard.</li>
          </ul>` },
        { kind: 'cli', title: 'Simple Rosen mVPN', code:
`vrf definition CUST-A
 rd 64500:100
 route-target export 64500:100
 route-target import 64500:100
 address-family ipv4
  mdt default 239.1.1.1
  mdt data 239.2.2.0 0.0.0.255 threshold 1
 exit-address-family
!
ip multicast-routing distributed
ip multicast-routing vrf CUST-A
!
interface GigabitEthernet0/0/1
 vrf forwarding CUST-A
 ip address 192.168.1.1 255.255.255.252
 ip pim sparse-mode` },
      ],
    },

    {
      id: 'l2-snooping',
      title: 'Layer-2 — IGMP & MLD Snooping',
      tagline: 'Keeping multicast off uninterested switchports.',
      icon: '🔍',
      sections: [
        { kind: 'prose', html: `
          <p>A switch, by default, floods multicast to every port in a VLAN — it is L2 unknown. <b>IGMP Snooping</b> peeks at IGMP packets to learn which ports have joined which groups, and only forwards multicast to those ports. MLD Snooping does the same for IPv6.</p>
          <p>Enabled by default on most enterprise switches today. The one configuration item is the <b>querier</b> — on a VLAN with no multicast router, snooping needs an IGMP querier or state times out.</p>` },
        { kind: 'cli', title: 'Snooping config', code:
`ip igmp snooping
ip igmp snooping vlan 100 querier
ip igmp snooping vlan 100 querier version 3
ip igmp snooping vlan 100 immediate-leave
!
show ip igmp snooping
show ip igmp snooping groups
show ip igmp snooping mrouter` },
        { kind: 'callout', level: 'tip', title: 'Immediate-leave only with one receiver per port', body: `<code>immediate-leave</code> removes a port from the group as soon as a Leave message is received, skipping the Group-Specific Query. This is correct for edge ports with one host (phones, cameras) but breaks with multiple receivers behind a dumb switch — the remaining ones lose traffic.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'RPF failures, "no mroute", and reading mroute output.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Core diagnostic commands', code:
`! Forwarding state
show ip mroute
show ip mroute 239.1.2.3
show ip mroute active                       ! actively forwarding groups
show ip mroute count                        ! packet/byte stats

! RPF check — is the unicast path symmetric?
show ip rpf 10.1.2.3
show ip rpf 10.1.2.3 239.1.2.3              ! with group context (for GRE/MPLS)

! PIM state
show ip pim interface
show ip pim rp mapping
show ip pim rp
show ip pim neighbor

! IGMP
show ip igmp groups
show ip igmp snooping groups

! Deep dig
debug ip pim                               ! RATE LIMIT!
debug ip mpacket 239.1.2.3` },
        { kind: 'table', title: 'Symptom → cause', headers: ['Symptom','Likely cause'], rows: [
          ['Receiver joins but gets no traffic','No (S,G) at LHR — check PIM join path, RPF'],
          ['(*,G) exists but no (S,G)','Source not sending, or FHR not forwarding to RP'],
          ['RPF check fails','Asymmetric unicast routing — enable mBGP or use static mroutes'],
          ['Flooding everywhere','Dense mode fallback — remove sparse-dense, configure RP'],
          ['Snooped VLAN drops traffic','No querier on VLAN; enable snooping querier'],
          ['SSM works but ASM does not','RP unreachable — check mapping and unicast reachability'],
        ]},
        { kind: 'callout', level: 'tip', title: 'The "G" in (S,G) is only half the story', body: `Always look at <code>show ip mroute &lt;group&gt;</code> and read the incoming interface (IIF) and outgoing interface list (OIL). If IIF is Null, RPF failed. If OIL is empty or all pruned, receivers are not joining. The state machine is visible — you do not need to guess.` },
      ],
    },
  ],
};
