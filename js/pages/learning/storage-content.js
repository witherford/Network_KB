// Storage learning centre — block, file, object, fabric, data services, cloud, troubleshooting.
export const CURRICULUM = {
  id: 'storage',
  title: 'Storage',
  tagline: 'Block, file, object — fabrics, RAID, multipathing, NVMe-oF, snapshots, replication, cloud.',
  estimatedMinutes: 260,
  modules: [
    {
      id: 'overview',
      icon: '💾',
      title: 'Overview & Core Concepts',
      tagline: 'Block vs file vs object — IOPS, throughput, latency, queue depth.',
      sections: [
        { kind: 'prose', html: `<p>Storage workloads break into three access patterns. <b>Block</b> presents raw LUNs that the host formats with a filesystem (databases, VM disks). <b>File</b> presents a hierarchical namespace over a network protocol (user shares, home directories). <b>Object</b> presents flat keys over HTTP (backups, media, data lakes).</p><p>Three numbers describe every workload: <b>IOPS</b> (operations per second, dominated by latency), <b>throughput</b> (MB/s, dominated by bandwidth), and <b>latency</b> (response time, the one users actually feel). A 4 KB random workload is IOPS-bound; a 1 MB sequential workload is throughput-bound. Queue depth (how many requests are in flight) ties them together — <code>IOPS = QD / latency</code>.</p>` },
        { kind: 'table', title: 'Access patterns at a glance',
          headers: ['Type', 'Unit', 'Protocols', 'Typical use', 'Mutability'],
          rows: [
            ['Block', 'LBA / sector', 'FC, FCoE, iSCSI, NVMe-oF', 'DB, VM datastores, boot LUNs', 'In-place writes'],
            ['File', 'File / directory', 'NFS, SMB/CIFS', 'User shares, app data', 'In-place writes'],
            ['Object', 'Key / bucket', 'S3, Swift (HTTP REST)', 'Backups, media, archives, data lakes', 'Immutable; new version on PUT']
          ]
        },
        { kind: 'callout', level: 'tip', title: 'Pick the right tool',
          body: `Don't run a database on object storage and don't keep ten million tiny files on a NAS share. Match the access pattern to the storage class — mismatches show up as latency spikes, metadata pressure, or eye-watering API bills.` }
      ]
    },
    {
      id: 'block-storage',
      icon: '🧱',
      title: 'Block Storage — SAN Fundamentals',
      tagline: 'LUNs, initiators, targets, FC vs iSCSI vs NVMe-oF.',
      sections: [
        { kind: 'prose', html: `<p>A <b>SAN</b> (Storage Area Network) presents block devices to hosts. The host sees them as local disks but they live on an array reached over a fabric. Three components matter: the <b>initiator</b> (the host HBA/NIC), the <b>target</b> (the array port), and the <b>LUN</b> (the logical unit — a slice of array capacity exposed as a SCSI/NVMe device).</p><p>Three transports dominate: <b>Fibre Channel</b> (purpose-built, lossless, low latency, expensive), <b>iSCSI</b> (SCSI over TCP/IP, runs on commodity Ethernet), and <b>NVMe-oF</b> (the modern replacement for both — much lower CPU overhead and parallelism).</p>` },
        { kind: 'diagram', title: 'SAN data path',
          ascii: `  Host (Initiator)              Array (Target)
  +----------+                  +------------+
  |  App     |                  |  Cache     |
  |  FS      |                  |  Pool      |
  |  Driver  |                  |  Disks/SSD |
  |  HBA/NIC |==== Fabric ====> |  Port      |
  +----------+   FC / Eth       +------------+
                 (zones / VLAN)
              LUN = slice of pool, masked to initiator WWN/IQN`
        },
        { kind: 'table', title: 'Transport comparison',
          headers: ['Property', 'Fibre Channel', 'iSCSI', 'NVMe-oF (TCP/RoCE/FC)'],
          rows: [
            ['Speed', '8/16/32/64 Gb', '1/10/25/100 GbE', '25/100/200 GbE / 32G FC'],
            ['Loss tolerance', 'Lossless (BB credits)', 'TCP recovers loss', 'TCP/RoCE — RoCE needs PFC'],
            ['CPU cost', 'Low (HBA offload)', 'Moderate', 'Very low (queue per core)'],
            ['Cabling', 'Dedicated FC fabric', 'Existing Ethernet', 'Either']
          ]
        },
        { kind: 'callout', level: 'info', title: 'When to pick which',
          body: 'Fibre Channel for legacy enterprise apps with strict latency budgets and an existing fabric team. iSCSI when you want to reuse Ethernet skills and gear. NVMe-oF for modern flash arrays and anything latency-sensitive built in the last few years.' }
      ]
    },
    {
      id: 'file-storage',
      icon: '📁',
      title: 'File Storage — NAS, NFS, SMB',
      tagline: 'Network filesystems, exports/shares, locking, ACLs.',
      sections: [
        { kind: 'prose', html: `<p><b>NAS</b> (Network Attached Storage) presents a filesystem over the network. Two protocols rule: <b>NFS</b> (Network File System — UNIX/Linux origin, stateless in v3, stateful in v4) and <b>SMB</b> (Server Message Block — Windows origin, stateful, ACL-rich). Modern arrays speak both ("multi-protocol").</p><p>Critical concepts: <b>exports/shares</b> (what's published), <b>mount points</b> (where the client attaches), <b>locking</b> (NLM for NFSv3, integrated for NFSv4/SMB), and <b>permissions</b> (POSIX mode bits, NFSv4 ACLs, NTFS ACLs, or a translation layer).</p>` },
        { kind: 'cli', title: 'Linux — mount NFS export',
          code: `# One-off mount
mount -t nfs -o vers=4.1,sec=sys,hard,timeo=600 nas01:/exports/data /mnt/data

# Persistent (/etc/fstab)
nas01:/exports/data  /mnt/data  nfs  vers=4.1,hard,timeo=600,_netdev  0 0

# Inspect
showmount -e nas01            # NFSv3 export list
nfsstat -m                    # mount options + counters
cat /proc/self/mountstats     # per-mount RPC stats`,
          desc: 'Use vers=4.1 or 4.2 for new deployments — better security and locking. Stick with hard,intr semantics so writes are not silently lost.' },
        { kind: 'cli', title: 'Windows — mount SMB share',
          code: `# Drive letter
net use Z: \\\\fs01\\share /persistent:yes /user:CORP\\alice

# PowerShell — multichannel-aware
New-SmbMapping -LocalPath 'Z:' -RemotePath '\\\\fs01\\share' -Persistent $true
Get-SmbConnection            # active sessions, dialect, multichannel
Get-SmbClientConfiguration   # client-side tunables`,
          desc: 'SMB 3.x adds multichannel, encryption, and persistent handles. Always negotiate at least 3.0; disable SMBv1 system-wide.' },
        { kind: 'callout', level: 'warn', title: 'Lock the protocol version',
          body: 'NFSv3 and SMBv1 are still common in legacy estates. NFSv3 has weak auth (UID-based), SMBv1 is end-of-life and a known ransomware vector. Force v4.1+/3.x at the share and on the client.' }
      ]
    },
    {
      id: 'object-storage',
      icon: '🪣',
      title: 'Object Storage & S3',
      tagline: 'Buckets, keys, versioning, lifecycle, eventual consistency.',
      sections: [
        { kind: 'prose', html: `<p>Object storage flattens the namespace: a <b>bucket</b> contains <b>objects</b>, each addressed by a <b>key</b>. There are no directories — slashes in the key are just characters that some tools render as folders. Every object has metadata (system-managed and user-defined) and a body. Operations are HTTP verbs: PUT, GET, DELETE, HEAD, LIST.</p><p>Object stores trade in-place mutation for scale. Updating an object replaces it (often as a new version). Listing is eventually consistent on some implementations. Strong read-after-write consistency is now standard on AWS S3 and most modern stores, but cross-region replication is still asynchronous.</p>` },
        { kind: 'cli', title: 'AWS CLI — S3 essentials',
          code: `# List & navigate
aws s3 ls s3://my-bucket/ --recursive --human-readable
aws s3api list-objects-v2 --bucket my-bucket --prefix logs/ --max-items 100

# Upload with server-side encryption + storage class
aws s3 cp ./build.tar.gz s3://my-bucket/releases/build.tar.gz \\
   --sse aws:kms --sse-kms-key-id alias/store --storage-class INTELLIGENT_TIERING

# Versioning + lifecycle
aws s3api put-bucket-versioning --bucket my-bucket --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket my-bucket --lifecycle-configuration file://lc.json

# Pre-signed URL (15-minute download link)
aws s3 presign s3://my-bucket/report.pdf --expires-in 900`,
          desc: 'Versioning + a deny-delete bucket policy is the simplest "ransomware-resistant" pattern for cloud object storage.' },
        { kind: 'table', title: 'Storage classes (AWS S3 reference)',
          headers: ['Class', 'Use case', 'Min duration', 'Retrieval'],
          rows: [
            ['STANDARD', 'Hot data', 'None', 'Immediate'],
            ['INTELLIGENT_TIERING', 'Unknown access patterns', 'None', 'Immediate'],
            ['STANDARD_IA / ONEZONE_IA', 'Infrequent access', '30 days', 'Immediate'],
            ['GLACIER_IR', 'Archive, instant', '90 days', 'Immediate'],
            ['GLACIER_FR / DEEP_ARCHIVE', 'Cold archive', '90 / 180 days', 'Minutes to hours']
          ]
        }
      ]
    },
    {
      id: 'raid',
      icon: '🧮',
      title: 'RAID & Erasure Coding',
      tagline: 'RAID 0/1/5/6/10, rebuild times, declustered RAID, EC.',
      sections: [
        { kind: 'prose', html: `<p>RAID combines disks for capacity, performance, or resilience. The classic levels: <b>RAID 0</b> (stripe — speed, zero protection), <b>RAID 1</b> (mirror — half capacity, fastest rebuild), <b>RAID 5</b> (single parity — 1 disk fault tolerance), <b>RAID 6</b> (double parity — 2 disk fault tolerance), <b>RAID 10</b> (mirrored stripes — best performance + protection at 50% efficiency).</p><p>Modern arrays use <b>declustered RAID</b> or <b>erasure coding</b> to spread parity across many drives so rebuilds stay fast as drives grow. With 20 TB drives, a traditional RAID 5 rebuild can take days — the rebuild window is now the dominant risk, not the original disk failure.</p>` },
        { kind: 'table', title: 'RAID levels',
          headers: ['Level', 'Min disks', 'Fault tolerance', 'Capacity efficiency', 'Write penalty'],
          rows: [
            ['RAID 0', '2', '0', '100%', '1 (no parity)'],
            ['RAID 1', '2', '1 (per pair)', '50%', '2 (write to both)'],
            ['RAID 5', '3', '1', '(N-1)/N', '4 (read-modify-write)'],
            ['RAID 6', '4', '2', '(N-2)/N', '6'],
            ['RAID 10', '4', '1 per mirror pair', '50%', '2'],
            ['Erasure coding (e.g. 8+3)', '11', '3', '8/11 ≈ 73%', 'Variable; large I/O batched']
          ]
        },
        { kind: 'callout', level: 'warn', title: 'The RAID 5 rebuild trap',
          body: 'On large SATA drives (>4 TB) RAID 5 rebuild times exceed the manufacturer URE (unrecoverable read error) rate, meaning a second failure is statistically likely during rebuild. Use RAID 6 or declustered/erasure-coded layouts above ~4 TB drive size.' },
        { kind: 'cli', title: 'Linux — inspect software RAID (mdadm)',
          code: `cat /proc/mdstat                       # current state, rebuild progress
mdadm --detail /dev/md0                # array summary
mdadm --examine /dev/sd[a-d]1          # per-device superblocks
echo 200000 > /proc/sys/dev/raid/speed_limit_max   # speed up rebuild`
        }
      ]
    },
    {
      id: 'multipathing',
      icon: '🔀',
      title: 'Multipathing & Path Management',
      tagline: 'MPIO, ALUA, active/active vs active/passive, queue depth.',
      sections: [
        { kind: 'prose', html: `<p><b>Multipathing</b> presents one logical device to the OS while routing I/O over multiple physical paths to the array. It buys you both <b>resilience</b> (a failed link, switch, or array port doesn't kill the LUN) and, when paths are active/active, <b>performance</b> (round-robin across links).</p><p><b>ALUA</b> (Asymmetric Logical Unit Access) lets the array tell the host which paths are <i>optimised</i> (owned by the controller that owns the LUN) versus <i>non-optimised</i> (the other controller — works but adds an internal hop). Good multipathing drivers prefer optimised paths and only failover when needed.</p>` },
        { kind: 'cli', title: 'Linux — device-mapper multipath',
          code: `multipath -ll                       # list paths per LUN
multipathd -k                       # interactive shell
  > show paths
  > show maps topology
  > reconfigure

# Friendly names + per-array policy in /etc/multipath.conf
defaults {
    user_friendly_names yes
    path_grouping_policy group_by_prio
    path_selector       "service-time 0"
    failback            immediate
}
devices {
    device {
        vendor "PURE"
        product "FlashArray"
        path_checker tur
        prio alua
    }
}`,
          desc: 'service-time selector picks the path with the lowest in-flight latency. Pair with prio alua so the array, not the host, decides path priority.' },
        { kind: 'cli', title: 'VMware ESXi — claim rules',
          code: `esxcli storage nmp device list
esxcli storage nmp device set --device naa.xxxx --psp VMW_PSP_RR
esxcli storage nmp psp roundrobin deviceconfig set --device naa.xxxx --iops 1 --type iops
esxcli storage core path list`,
          desc: 'Round-Robin with IOPS=1 used to be the rule. Modern arrays often want Latency-based PSP — check your vendor HCL.' },
        { kind: 'callout', level: 'tip', title: 'Always two of everything',
          body: 'Two HBAs/NICs, two switches, two array controllers, two cables per host — and verify each path independently fails. A SAN that has never had a path tested is a SAN that will fail under load.' }
      ]
    },
    {
      id: 'fc-fabric',
      icon: '🧬',
      title: 'Fibre Channel Fabric',
      tagline: 'WWN, FLOGI/PLOGI, zoning, VSAN, NPV/NPIV.',
      sections: [
        { kind: 'prose', html: `<p>An FC <b>fabric</b> is built from one or more switches that share a name service. Each port has a <b>WWPN</b> (World-Wide Port Name, like a MAC) and each node a <b>WWNN</b>. Hosts log in (FLOGI to the switch, PLOGI to the target) and the fabric assigns a 24-bit FCID for routing. Frames travel over <b>VSANs</b> (FC's equivalent of VLANs) and are filtered by <b>zones</b>.</p><p>Best practice: <b>single-initiator zoning</b>. One zone per host port, containing exactly one host WWPN and the array WWPNs it should see. Avoid one big "all-hosts-all-targets" zone — zone-set explosions and noisy neighbours are the result.</p>` },
        { kind: 'cli', title: 'Cisco MDS — zoning workflow',
          code: `! Discover what is logged in
show flogi database
show fcns database vsan 10

! Create alias + zone + zoneset (VSAN 10)
device-alias database
  device-alias name HOSTA-HBA0   pwwn 10:00:00:11:22:33:44:55
  device-alias name ARRAY-CT0FC0 pwwn 52:4a:93:71:11:22:33:44
  device-alias commit

zone name HOSTA-HBA0_ARRAY vsan 10
  member device-alias HOSTA-HBA0
  member device-alias ARRAY-CT0FC0

zoneset name PROD-ZS vsan 10
  member HOSTA-HBA0_ARRAY
zoneset activate name PROD-ZS vsan 10
copy run start

! Verify
show zoneset active vsan 10`,
          desc: 'Activate one zoneset per VSAN. The active zoneset is what enforces — anything outside it cannot communicate.' },
        { kind: 'cli', title: 'Brocade — zoning workflow',
          code: `nsshow                                  # name service
alicreate "HOSTA_HBA0", "10:00:00:11:22:33:44:55"
alicreate "ARRAY_CT0",  "52:4a:93:71:11:22:33:44"
zonecreate "HOSTA_HBA0_ARRAY", "HOSTA_HBA0; ARRAY_CT0"
cfgcreate  "PROD", "HOSTA_HBA0_ARRAY"
cfgenable  "PROD"
cfgsave`
        },
        { kind: 'callout', level: 'info', title: 'NPV / NPIV',
          body: 'NPV makes a switch an aggregator that proxies host FLOGIs upstream — useful in blade chassis to keep the fabric domain count low. NPIV lets one physical port present multiple WWPNs — needed for VM-level zoning.' }
      ]
    },
    {
      id: 'iscsi-deep',
      icon: '🌐',
      title: 'iSCSI in Depth',
      tagline: 'Portals, IQNs, sessions, CHAP, jumbo frames.',
      sections: [
        { kind: 'prose', html: `<p>iSCSI carries SCSI commands inside TCP. An <b>initiator</b> (identified by an <b>IQN</b>, e.g. <code>iqn.1994-05.com.redhat:host01</code>) connects to a <b>target portal</b> (IP:3260). The session contains one or more <b>connections</b>; each can use a different network path to give you multipathing without anything below the IP layer being aware.</p><p>Performance levers: <b>jumbo frames</b> end-to-end (MTU 9000 — and verify with ping -M do -s 8972), <b>per-portal multipathing</b> (separate VLANs/subnets for each path), and <b>iSCSI offload</b> on the NIC where supported. Authentication is <b>CHAP</b> — one-way for hosts, mutual for sensitive environments.</p>` },
        { kind: 'cli', title: 'Linux — open-iscsi initiator',
          code: `# IQN of this host
cat /etc/iscsi/initiatorname.iscsi

# Discovery (sendtargets)
iscsiadm -m discovery -t st -p 10.10.10.10:3260

# Configure CHAP (per-target)
iscsiadm -m node -T iqn.2010-06.com.array:lun01 -p 10.10.10.10 \\
   -o update -n node.session.auth.authmethod -v CHAP
iscsiadm -m node -T iqn.2010-06.com.array:lun01 -p 10.10.10.10 \\
   -o update -n node.session.auth.username -v host01
iscsiadm -m node -T iqn.2010-06.com.array:lun01 -p 10.10.10.10 \\
   -o update -n node.session.auth.password -v 'long-shared-secret'

# Login + verify
iscsiadm -m node -T iqn.2010-06.com.array:lun01 -p 10.10.10.10 --login
iscsiadm -m session -P3
lsblk -S`,
          desc: 'Always run discovery against every portal IP. Then iscsiadm -m node --loginall=automatic if you want auto-recovery on boot.' },
        { kind: 'cli', title: 'Validate jumbo frames end-to-end',
          code: `# Linux
ping -M do -s 8972 10.10.10.10
# Windows
ping -f -l 8972 10.10.10.10

# If fragmentation needed, MTU is wrong somewhere on the path
# Check switch interface MTU and host NIC MTU; both must be 9000+`,
          desc: 'Jumbo frames must match end-to-end including switch ports. A single 1500-MTU hop and your large reads silently slow to a crawl.' }
      ]
    },
    {
      id: 'nvme-of',
      icon: '⚡',
      title: 'NVMe & NVMe-over-Fabrics',
      tagline: 'Queues, namespaces, NVMe/TCP, NVMe/RoCE, NVMe/FC.',
      sections: [
        { kind: 'prose', html: `<p>NVMe replaces the single-queue, lock-heavy SCSI stack with thousands of <b>parallel queues</b> (one or more per CPU core) and a much shorter command set. <b>NVMe-oF</b> takes that model onto the wire. Three transports: <b>NVMe/TCP</b> (no special hardware, runs on any IP network), <b>NVMe/RoCE</b> (RDMA over Converged Ethernet — needs DCB/PFC), and <b>NVMe/FC</b> (rides existing FC fabrics, no new transport).</p><p>An NVMe target presents <b>namespaces</b> (the NVMe equivalent of LUNs). The host attaches them as <code>/dev/nvmeXnY</code>. Multipathing is built in (ANA — Asymmetric Namespace Access — the NVMe equivalent of ALUA), so you generally don't need device-mapper-multipath on top.</p>` },
        { kind: 'cli', title: 'Linux — nvme-cli essentials',
          code: `# Show NVMe controllers + namespaces
nvme list
nvme list-subsys

# Connect to NVMe/TCP target
nvme discover -t tcp -a 10.20.30.40 -s 4420
nvme connect -t tcp -a 10.20.30.40 -s 4420 \\
   -n nqn.2014-08.com.example:array:ns1

# Inspect & disconnect
nvme list-ns /dev/nvme0
nvme disconnect -n nqn.2014-08.com.example:array:ns1

# Native multipathing status
cat /sys/class/nvme-subsystem/nvme-subsys0/iopolicy   # numa | round-robin`,
          desc: 'Use iopolicy=round-robin on all-active controllers; numa is the safe default and prefers the local controller.' },
        { kind: 'table', title: 'Transport choice',
          headers: ['Transport', 'Network', 'Hardware', 'Latency vs FC', 'Notes'],
          rows: [
            ['NVMe/TCP', 'Standard Ethernet', 'Any NIC', '~ same or slightly higher', 'Easiest to deploy; no DCB needed'],
            ['NVMe/RoCE', 'Lossless Ethernet', 'RDMA NIC + DCB/PFC', 'Lower', 'Lossless config errors are catastrophic'],
            ['NVMe/FC', 'Existing FC fabric', 'Modern HBA', 'Lowest', 'Reuses zoning, monitoring, skills']
          ]
        },
        { kind: 'callout', level: 'warn', title: 'Don\'t stack multipath on NVMe-oF',
          body: 'NVMe-oF has native ANA multipathing. Adding device-mapper-multipath on top breaks fail-over and serializes I/O. Disable dm-multipath claiming for NVMe devices.' }
      ]
    },
    {
      id: 'data-services',
      icon: '🛠️',
      title: 'Data Services — Snapshots, Replication, Dedupe',
      tagline: 'Snapshots, clones, sync/async replication, dedupe, compression.',
      sections: [
        { kind: 'prose', html: `<p>Modern arrays bundle "data services" as space- and time-efficient operations on the storage pool. Key ones:</p><ul><li><b>Snapshots</b> — point-in-time, copy-on-write or redirect-on-write. Cheap to take, expensive to keep if churn is high.</li><li><b>Clones</b> — writable snapshots. Useful for VM provisioning, dev/test refresh.</li><li><b>Replication</b> — synchronous (zero-RPO, distance-limited) or asynchronous (defined RPO, journaled, distance-tolerant).</li><li><b>Deduplication</b> — fingerprint blocks, store one copy. Inline is preferred (saves writes); post-process is older but simpler.</li><li><b>Compression</b> — block-level or pattern-aware; usually layered before dedupe on the write path.</li></ul>` },
        { kind: 'table', title: 'Replication models',
          headers: ['Mode', 'RPO', 'Distance', 'How it works', 'Trade-off'],
          rows: [
            ['Synchronous', '0', '< 100 km (latency-bound)', 'Write ack only after remote ack', 'Adds RTT to every write'],
            ['Asynchronous (snap-based)', 'Minutes-hours', 'Unlimited', 'Periodic delta snapshot ship', 'Network-friendly, RPO = interval'],
            ['Asynchronous (journal/CDP)', 'Seconds', 'Unlimited (within bandwidth)', 'Journal of every write shipped', 'Storage + bandwidth heavy'],
            ['Active-active (metro/stretched)', '0', '< 10 ms RTT', 'Both sites accept writes; locking via witness', 'Complex, needs third-site quorum']
          ]
        },
        { kind: 'callout', level: 'tip', title: 'Snapshots are not backups',
          body: 'A snapshot lives on the same array. If the array, datacenter, or admin account is compromised, the snapshot goes with it. Always pair snapshots with off-array, off-account, immutable backups.' }
      ]
    },
    {
      id: 'cloud-storage',
      icon: '☁️',
      title: 'Cloud Storage Patterns',
      tagline: 'EBS/Managed Disk, EFS/Files, S3/Blob, gateways, hybrid.',
      sections: [
        { kind: 'prose', html: `<p>Hyperscalers expose all three storage classes — block, file, object — as managed services. They behave like the on-prem equivalents but bill per GB-month plus per-operation, and cap throughput by volume size or tier.</p>` },
        { kind: 'table', title: 'Cloud storage cheat sheet',
          headers: ['Class', 'AWS', 'Azure', 'Google Cloud'],
          rows: [
            ['Block (single-attach)', 'EBS (gp3, io2)', 'Managed Disk (Premium SSD v2, Ultra)', 'Persistent Disk (pd-ssd, hyperdisk)'],
            ['Block (shared)', 'EBS Multi-Attach (io2)', 'Shared Disk', 'Hyperdisk Multi-Writer'],
            ['File (NFS/SMB)', 'EFS, FSx for NetApp/Lustre/Windows', 'Azure Files, NetApp Files', 'Filestore, NetApp Volumes'],
            ['Object', 'S3', 'Blob Storage', 'Cloud Storage'],
            ['Archive', 'S3 Glacier / Deep Archive', 'Archive tier', 'Archive class'],
            ['Hybrid gateway', 'Storage Gateway', 'Azure StorSimple / DataBox', 'Storage Transfer / Filestore Backup']
          ]
        },
        { kind: 'callout', level: 'warn', title: 'Throughput vs IOPS caps',
          body: 'Every cloud volume has an IOPS and throughput ceiling tied to its tier or size. A small gp3 volume that worked fine in test will throttle in production. Always size for the IOPS/throughput floor you need, not just capacity.' },
        { kind: 'callout', level: 'tip', title: 'Egress is the hidden bill',
          body: 'Storage at rest is cheap; pulling data back out is not. Region-to-internet egress on every cloud is multiple cents per GB. Keep compute next to the data, use VPC endpoints / Private Link, and watch lifecycle policies that move data between tiers more than once.' }
      ]
    },
    {
      id: 'troubleshooting',
      icon: '🩺',
      title: 'Troubleshooting Storage',
      tagline: 'Latency, queue depth, IOPS, fabric errors, SMART.',
      sections: [
        { kind: 'prose', html: `<p>Storage problems show up as <b>latency</b> first. Throughput and IOPS are derived numbers — they're symptoms of either a saturated path, a queue-depth ceiling, or a slow target. Walk the stack: app → filesystem → block layer → multipath → HBA/NIC → fabric → array port → controller → media.</p>` },
        { kind: 'cli', title: 'Linux — first-pass diagnostics',
          code: `# Per-device latency, queue depth, utilisation
iostat -xz 1
# r_await + w_await > a few ms = look upstream; %util ~ 100 = saturated
# avgqu-sz climbing = backed up

# Block device queue depth
cat /sys/block/sdX/queue/nr_requests
cat /sys/block/sdX/device/queue_depth

# Per-process I/O wait
pidstat -d 1
iotop -oP

# Multipath path errors
multipath -ll | grep -E 'failed|faulty'
dmesg -T | egrep -i 'scsi|multipath|nvme|fc|qla|lpfc|mpt'`
        },
        { kind: 'cli', title: 'Drive health — SMART',
          code: `smartctl -a /dev/sda                  # full report
smartctl -t long /dev/sda             # background self-test (~hours)
smartctl -l selftest /dev/sda         # results
nvme smart-log /dev/nvme0             # NVMe equivalent`,
          desc: 'Watch Reallocated_Sector_Ct, Pending_Sector, Offline_Uncorrectable, Wear_Leveling_Count, Media_Wearout_Indicator. Any non-zero on the first three on a SATA drive = replace.' },
        { kind: 'cli', title: 'Fabric checks',
          code: `# Cisco MDS
show interface counters errors
show flogi internal event-history errors
show port internal info interface fc1/1

# Brocade
porterrshow
portstatsshow 12
fabricshow`,
          desc: 'CRC errors and class-3 frame discards on FC ports almost always trace to a dirty/damaged optic or cable. Clean and re-seat first, replace second.' },
        { kind: 'checklist', title: 'Storage outage triage',
          items: [
            'Is it the whole array or one host?',
            'Multipath: are paths up on every host?',
            'Fabric: any port errors, link flaps, zoneset changes in the last hour?',
            'Array controller utilisation, cache hit ratio, ports balanced?',
            'Replication links healthy and within RPO?',
            'Any recent changes — firmware, driver, MTU, zoning, lifecycle policies?',
            'SMART/SFP optics on suspect drives and ports?',
            'App-level: queue depth setting, FS journal mode, OS scheduler?'
          ]
        }
      ]
    }
  ]
};
