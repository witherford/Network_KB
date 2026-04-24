// QoS learning curriculum.

export const CURRICULUM = {
  id: 'qos',
  title: 'Quality of Service (QoS)',
  tagline: 'Classification, marking, queuing, shaping/policing, and end-to-end DiffServ design.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 220,
  modules: [
    {
      id: 'overview',
      title: 'Concepts & When QoS Matters',
      tagline: 'Congestion, jitter, loss, and the limits of "just add bandwidth".',
      icon: '🎚️',
      sections: [
        { kind: 'prose', html: `
          <p><b>QoS</b> is not a magic speed-up — it is a <em>policy for dealing with congestion</em>. A link running at 50% utilisation with good burst behaviour does not need QoS. A link at 95% utilisation with mixed voice, video, and bulk traffic needs it badly: without QoS, a single FTP transfer will deliver unusable voice quality by inflating queue depth.</p>
          <p>QoS has six building blocks, in processing order:</p>
          <ol>
            <li><b>Classification</b> — identify packets by characteristic (ACL, DSCP, NBAR).</li>
            <li><b>Marking</b> — stamp a label (DSCP / CoS / MPLS EXP) so downstream devices can trust and act without reclassifying.</li>
            <li><b>Policing</b> — drop or remark traffic that exceeds a rate (ingress-style, hard).</li>
            <li><b>Shaping</b> — delay excess traffic in a buffer to smooth it to a rate (egress-style, soft).</li>
            <li><b>Queuing</b> — schedule packets out the interface (LLQ, CBWFQ, WRR, DWRR).</li>
            <li><b>Congestion avoidance</b> — WRED, ECN drop probabilistically before queues fill.</li>
          </ol>` },
        { kind: 'table', title: 'Application sensitivities', headers: ['Traffic','Latency budget','Jitter budget','Loss budget'], rows: [
          ['Voice (G.711)','150 ms one-way','≤ 30 ms','≤ 1%'],
          ['Video conferencing','150 ms','≤ 30 ms','≤ 0.1%'],
          ['Streaming video','2-5 s (buffered)','n/a','≤ 0.5%'],
          ['Interactive data (RDP/VDI)','150 ms','≤ 30 ms','≤ 0.1%'],
          ['Bulk data','5 s+','n/a','TCP recovers'],
        ]},
        { kind: 'callout', level: 'info', title: 'QoS helps at the bottleneck, nowhere else', body: `If your 10 Gbps core is at 5% and your 50 Mbps WAN is at 90%, only the WAN interface benefits from QoS. Apply classification once close to the source (trust the DSCP downstream), and apply queuing at every congested link. Applying LLQ on an uncontested 10G interface costs effort and delivers nothing.` },
      ],
    },

    {
      id: 'markings',
      title: 'Marking — CoS, DSCP, MPLS EXP',
      tagline: 'What each field carries and how they map to each other.',
      icon: '🏷️',
      sections: [
        { kind: 'table', title: 'QoS marking fields', headers: ['Field','Layer','Bits','Where','Range'], rows: [
          ['IEEE 802.1p (CoS)','L2','3 in .1Q tag','Tagged Ethernet frame','0-7'],
          ['IP Precedence','L3','3 in IP ToS byte','Legacy IPv4','0-7'],
          ['DSCP','L3','6 in IP ToS byte','IPv4/IPv6','0-63 (AF, CS, EF, DF)'],
          ['MPLS EXP / Traffic Class','MPLS','3 in label','MPLS shim','0-7'],
        ]},
        { kind: 'table', title: 'DSCP PHB names used in real designs', headers: ['PHB','DSCP (binary)','DSCP (decimal)','Typical use'], rows: [
          ['EF','101110','46','Voice'],
          ['AF41 / AF42 / AF43','1000xx','34 / 36 / 38','Video conferencing (drop precedence low/med/high)'],
          ['AF31 / AF32 / AF33','011xxx','26 / 28 / 30','Interactive / mission-critical data'],
          ['AF21 / AF22 / AF23','010xxx','18 / 20 / 22','Transactional / call-signalling'],
          ['AF11 / AF12 / AF13','001xxx','10 / 12 / 14','Bulk data'],
          ['CS1','001000','8','Scavenger (background)'],
          ['DF (default)','000000','0','Best effort'],
        ]},
        { kind: 'callout', level: 'tip', title: 'Mark at the trust boundary, trust downstream', body: `The ideal is one place where marking happens — the trust boundary, usually the access switch or the IP phone. Everywhere else <em>trusts</em> the marking by using <code>mls qos trust dscp</code> / <code>qos trust dscp</code>. Re-classifying at every hop wastes CPU/TCAM and invites drift between policies.` },
      ],
    },

    {
      id: 'classification',
      title: 'Classification',
      tagline: 'ACLs, NBAR2, DSCP matching, and the MQC framework.',
      icon: '🔍',
      sections: [
        { kind: 'prose', html: `
          <p>The Cisco <b>Modular QoS CLI (MQC)</b> separates <em>what to match</em> (<code>class-map</code>) from <em>what to do</em> (<code>policy-map</code>) from <em>where to apply</em> (<code>service-policy</code>). Every modern Cisco platform uses this shape, so learning MQC pays off on almost every device.</p>` },
        { kind: 'cli', title: 'Class-maps — identify traffic', code:
`class-map match-any VOICE
 match dscp ef
!
class-map match-any VIDEO
 match dscp af41 af42 af43
!
class-map match-any CALL-SIGNAL
 match dscp af31 cs3
!
class-map match-any SCAVENGER
 match dscp cs1
!
class-map match-any NBAR-P2P
 match protocol attribute sub-category file-sharing` },
        { kind: 'cli', title: 'NBAR2 dynamic recognition', code:
`! NBAR2 recognises 1400+ applications by deep inspection
class-map match-any WEBCONF
 match protocol attribute category voice-and-video
 match protocol attribute application-group teams-media
!
show ip nbar protocol-discovery
show ip nbar protocol-attribute zoom-meetings` },
        { kind: 'callout', level: 'warn', title: 'NBAR2 does not help if the traffic is encrypted end-to-end', body: `Modern SaaS tools use TLS and often QUIC, and NBAR2 relies on signatures in unencrypted payloads. It still classifies correctly by <em>SNI</em> and JA3 fingerprints for many apps, but encrypted QUIC and ECH degrade accuracy. Combine NBAR with DSCP trust from the endpoint where possible.` },
      ],
    },

    {
      id: 'queuing',
      title: 'Queuing — LLQ, CBWFQ, WRED',
      tagline: 'Getting real-time traffic out of the door before bulk traffic fills the queue.',
      icon: '🚦',
      sections: [
        { kind: 'prose', html: `
          <p><b>Low-Latency Queuing (LLQ)</b> = Priority Queue + CBWFQ. Voice and real-time video go into the priority queue which is serviced first, up to a configured rate (<code>priority percent N</code>). Everything else is in CBWFQ classes with bandwidth guarantees (<code>bandwidth percent N</code>). Unallocated capacity goes to class-default.</p>` },
        { kind: 'cli', title: 'Classic LLQ + CBWFQ policy', code:
`policy-map WAN-OUT
 class VOICE
  priority percent 10 burst 32000       ! LLQ — hard cap
 class VIDEO
  bandwidth percent 20
  queue-limit 64 packets
 class CALL-SIGNAL
  bandwidth percent 5
 class SCAVENGER
  bandwidth percent 1
 class class-default
  bandwidth percent 44
  fair-queue
  random-detect dscp-based
!
interface GigabitEthernet0/0/0
 service-policy output WAN-OUT` },
        { kind: 'callout', level: 'warn', title: 'Do not overbook the priority queue', body: `A priority queue with <code>priority percent 30</code> on a 50 Mbps link allows 15 Mbps of voice. If your site genuinely sends 15 Mbps of voice, you have a scaling problem — that is ~470 concurrent G.711 calls. Most enterprise sites should size LLQ at 5–15% and reject the idea that "more priority = better quality". Priority with no cap is a DoS vector.` },
        { kind: 'prose', html: `
          <p><b>WRED (Weighted Random Early Detection)</b> drops packets probabilistically as a queue fills, before it is completely full. This works with TCP: each drop causes one TCP sender to back off. Without WRED, a full queue tail-drops and <em>every</em> TCP flow synchronises its back-off — "TCP global synchronisation", visible as a saw-tooth throughput graph.</p>`},
      ],
    },

    {
      id: 'shaping-policing',
      title: 'Shaping vs Policing',
      tagline: 'Token buckets, Bc/Be, and when to use which.',
      icon: '🧮',
      sections: [
        { kind: 'table', title: 'Shaping vs policing', headers: ['Feature','Shaping','Policing'], rows: [
          ['Action on excess','Delay (buffer)','Drop or remark'],
          ['Where it lives','Egress','Ingress or egress'],
          ['Output behaviour','Smooth, rate-matched','Bursty, clips excess'],
          ['Typical use','Match provider rate on subrate circuits','Enforce customer contract; rate-limit scavenger'],
          ['Cost','Memory for buffers; added delay','Dropped packets = TCP retransmits'],
        ]},
        { kind: 'cli', title: 'Shaper on a subrate handoff', code:
`policy-map 100M-SHAPER
 class class-default
  shape average 100000000           ! 100 Mbps
  service-policy WAN-OUT            ! nested LLQ/CBWFQ
!
interface GigabitEthernet0/0/0
 service-policy output 100M-SHAPER` },
        { kind: 'cli', title: 'Policer on scavenger / customer rate', code:
`policy-map CUSTOMER-IN
 class SCAVENGER
  police cir 2000000 bc 375000 be 0 conform-action transmit exceed-action drop
 class class-default
  police cir 100000000 bc 187500 be 0 conform-action transmit exceed-action set-dscp-transmit cs1` },
        { kind: 'callout', level: 'tip', title: 'Always shape on the CE toward the provider', body: `If your ISP delivers 100 Mbps via a 1 Gbps handoff, the router will blast at line rate and the ISP drops excess. <b>Shape egress to 100 Mbps (often a hair lower, ~95 Mbps)</b> on your side so queueing and WRED happen on your router where you have visibility, not inside the provider where you do not.` },
      ],
    },

    {
      id: 'congestion-avoidance',
      title: 'Congestion Avoidance — WRED & ECN',
      tagline: 'Dropping early and explicit notification instead of tail drop.',
      icon: '📉',
      sections: [
        { kind: 'prose', html: `
          <p><b>WRED</b> uses per-DSCP min/max thresholds and drop probability. As queue depth grows past min-threshold for a class, drop probability rises linearly until max-threshold where it hits the configured max-probability. Past max-threshold, everything in that class is tail-dropped.</p>
          <p><b>ECN</b> (RFC 3168) is smarter: instead of dropping, the router sets the ECN bits in the IP header. ECN-capable TCP endpoints slow down as if they had seen a drop, without the retransmit. Supported on modern Linux, Windows, macOS; switches and routers need explicit enable.</p>` },
        { kind: 'cli', title: 'WRED with ECN', code:
`policy-map WAN-OUT
 class class-default
  bandwidth remaining percent 100
  random-detect dscp-based
  random-detect ecn
  random-detect dscp 0 20 40 10     ! min 20, max 40, mark-prob-denominator 10
  random-detect dscp cs1 10 20 10   ! be more aggressive on scavenger` },
      ],
    },

    {
      id: 'autoqos',
      title: 'AutoQoS — When the Defaults Are Good Enough',
      tagline: 'Cisco\'s macro and when to extend it.',
      icon: '🪄',
      sections: [
        { kind: 'prose', html: `
          <p><b>AutoQoS VoIP</b> and <b>AutoQoS Enterprise</b> generate sensible class-maps, policy-maps, and interface configs with one command. The result is an 8- or 11-class model aligned with Cisco and Microsoft guidance. It is a solid starting baseline for any enterprise that does not want to hand-craft a policy.</p>` },
        { kind: 'cli', title: 'Enable AutoQoS on an interface', code:
`interface GigabitEthernet0/0/0
 auto qos trust dscp                 ! switch ports toward phones
 auto qos srnd4                      ! 12-class model on routers
!
! Inspect the generated config
show auto qos interface GigabitEthernet0/0/0
show policy-map interface GigabitEthernet0/0/0` },
        { kind: 'callout', level: 'tip', title: 'Treat AutoQoS output as a starter, not the final', body: `AutoQoS writes the config into running-config as if you had typed it. Accept the skeleton, then delete what you do not use (most sites do not need 11 classes), rename for clarity, and tune percentages to your site's traffic mix. It is the fastest way to go from nothing to a usable end-to-end policy.` },
      ],
    },

    {
      id: 'campus-vs-wan',
      title: 'Campus vs WAN QoS Design',
      tagline: 'Different constraints, different tools, different class counts.',
      icon: '🏛️',
      sections: [
        { kind: 'table', title: 'Where to apply what', headers: ['Location','Primary tools','Typical concern'], rows: [
          ['Access switchport (trust boundary)','Trust CoS/DSCP, policer for rogue marks','Establish mark at source'],
          ['Distribution uplinks','Trust DSCP, 4–6 class queuing','Rarely congested; queue profile matters for microbursts'],
          ['WAN CE','Nested shaper + LLQ/CBWFQ + WRED','The bottleneck — most QoS value here'],
          ['SD-WAN edge','Per-policy class, FEC for voice, per-app path selection','Underlay-agnostic'],
          ['Data centre','ECN on TCP class, PFC for RoCE/storage','Congestion at ToR; deep-buffered spines'],
        ]},
        { kind: 'callout', level: 'warn', title: 'Data-centre QoS looks nothing like WAN', body: `WAN QoS is "protect voice by sacrificing bulk". DC QoS is "protect storage (RoCEv2) by pausing Ethernet with PFC". They are different problems. If you apply WAN-style LLQ on DC TORs you will hurt performance. Use ECN for TCP, PFC for storage, and keep queue depth small across the fabric.` },
      ],
    },

    {
      id: 'sd-wan',
      title: 'QoS in SD-WAN',
      tagline: 'Per-app policy, multiple underlays, and FEC for voice.',
      icon: '🧭',
      sections: [
        { kind: 'prose', html: `
          <p>SD-WAN shifts the mental model. Instead of "this class gets this much bandwidth on this interface", you write <b>per-application policies</b> that say things like "voice always prefers MPLS; if MPLS loss &gt; 2% switch to internet; if both are bad, replicate with FEC". The platform measures path quality continuously (BFD/probes) and chooses per-flow.</p>
          <p>Class structure is similar — voice/video/transactional/bulk — but the mechanisms are: <b>path selection</b>, <b>forward error correction (FEC)</b>, <b>packet duplication</b>, and <b>application-aware routing (AAR)</b>. Classic LLQ still applies at each physical interface, but the interesting decisions happen at the overlay layer.</p>` },
        { kind: 'callout', level: 'tip', title: 'FEC helps voice, hurts bulk', body: `FEC adds redundant packets so lost ones can be recovered without retransmission — great for voice (low bandwidth, latency-sensitive). Turning FEC on for bulk traffic wastes bandwidth. Apply FEC only to voice/video classes.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'Drops, where they happen, and reading the policy-map counters.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Where are drops happening?', code:
`show policy-map interface GigabitEthernet0/0/0 output
! Look at offered rate per class, drops per class, queue depth.

show interfaces GigabitEthernet0/0/0 | include rate|drops|input queue|output queue

! Input errors, output drops, and queue starvation
show interfaces counters errors

! Platform-specific TCAM / queue stats
show platform hardware qos interface GigabitEthernet0/0/0

! WRED activity
show policy-map interface GigabitEthernet0/0/0 output | section random` },
        { kind: 'table', title: 'Symptom → cause', headers: ['Symptom','Likely cause'], rows: [
          ['Voice choppy during peak','Priority queue too small, or LLQ not applied at the bottleneck'],
          ['Bulk data slow; voice fine','Expected when bulk is policed — confirm with class counters'],
          ['All classes show drops evenly','Link actually oversubscribed — need more bandwidth, not more QoS'],
          ['Traffic not matching class','Reclassification — verify DSCP not overwritten upstream; check for tunnel copy-inner-dscp'],
          ['Policy applied but no effect','Interface not queueing (hardware limitation); check platform/FPGA capability'],
        ]},
        { kind: 'callout', level: 'tip', title: 'Drops in the class-default class-default class are normal', body: `When WAN is full, best-effort should drop — that is QoS doing its job. Alarm on drops in VOICE or CALL-SIGNAL, not in class-default or SCAVENGER. If you cannot tolerate <em>any</em> drop in any class, the site needs more capacity.` },
      ],
    },
  ],
};
