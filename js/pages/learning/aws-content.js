// Curriculum for the AWS learning centre — network-engineer focused.

export const CURRICULUM = {
  id: 'aws',
  title: 'Amazon Web Services (AWS)',
  tagline: 'AWS for network engineers — VPC, Transit Gateway, ELB, Direct Connect, Route 53, PrivateLink, observability, troubleshooting.',
  vendor: 'AWS',
  platform: 'AWS',
  badge: 'aws',
  estimatedMinutes: 280,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Core Concepts',
      icon: '☁️',
      tagline: 'Regions, Availability Zones, accounts, Organizations, IAM — the ground rules.',
      sections: [
        { kind: 'prose', html: `
          <p>AWS is globally distributed across <b>Regions</b> (e.g. <code>eu-west-1</code> Ireland). Each Region contains multiple <b>Availability Zones</b> (AZs) — physically separate data centres with independent power, cooling and networking. Design <i>everything</i> to survive a single-AZ loss by deploying across ≥ 2 AZs.</p>
          <p>At the top of the account tree is <b>AWS Organizations</b>. Your landing zone typically looks like <code>Root OU → Security OU, Workloads OU → Prod/Non-Prod accounts</code>. Each account is a hard isolation boundary — no default cross-account networking. Connectivity comes from VPC peering, Transit Gateway, PrivateLink, or resource-sharing via RAM.</p>
        `},
        { kind: 'diagram', title: 'The AWS footprint from 10,000 ft', ascii: `
   ┌──────────── AWS Organizations (root) ────────────┐
   │                                                  │
   │   Security OU        Workloads OU                │
   │   ├─ log-archive     ├─ prod-network             │
   │   ├─ audit           ├─ prod-app                 │
   │   └─ identity        ├─ nonprod-app              │
   │                      └─ sandbox                  │
   └──────────────────────────────────────────────────┘

        Region eu-west-1           Region us-east-1
        ┌──────────────┐           ┌──────────────┐
        │ AZ a  AZ b   │           │ AZ a  AZ b   │
        │ AZ c         │           │ AZ c  AZ d   │
        └──────────────┘           └──────────────┘
` },
        { kind: 'callout', level: 'info', title: 'Region choice is a commitment', body: 'Regions are isolated — cross-Region networking costs data-transfer money and adds latency. Pick your primary Region based on <b>users, data residency, service availability, and disaster-recovery strategy</b> and make that choice deliberately. Moving later means refactoring IaC, DNS, and compliance controls.' },
        { kind: 'table', title: 'Ports and endpoints you will meet', headers: ['Purpose','Endpoint / Port'], rows: [
          ['Regional service endpoints','<i>service</i>.<i>region</i>.amazonaws.com'],
          ['AWS API calls','TCP 443 → SigV4 signed'],
          ['SSM Session Manager','TCP 443 (no inbound SSH needed)'],
          ['VPC Endpoint (interface)','ENI in your subnet, TCP 443'],
          ['VPC Endpoint (gateway: S3, DDB)','route-table entry; no ENI'],
          ['Direct Connect BGP','TCP 179 over the private VIF'],
          ['Transit Gateway Connect','GRE over the underlay']
        ]},
        { kind: 'prose', html: `
          <h4>IAM — the universal control plane</h4>
          <p>Every AWS API call is authenticated and authorised by <b>IAM</b>. As a network engineer you will write and read IAM policies constantly — for SG modifications, VPC sharing, cross-account TGW attachments, and Route 53 private zones. Key concepts: <b>principals</b> (users, roles, services), <b>policies</b> (JSON), <b>Service Control Policies</b> (Organizations-wide guardrails), <b>resource-based policies</b> (attached to the resource, e.g. S3 bucket, endpoint service).</p>
        `}
      ]
    },

    {
      id: 'vpc',
      title: 'VPC Fundamentals',
      icon: '🏗️',
      tagline: 'CIDR planning, subnets, route tables, IGW, NAT gateways — the building blocks.',
      sections: [
        { kind: 'prose', html: `
          <p>A <b>VPC</b> is a private virtual network in one Region. You choose a CIDR (IPv4 /16 to /28 per block; up to 5 additional CIDRs; IPv6 is /56 assigned by Amazon or BYOIP). Subnets live inside a single AZ and carve out smaller CIDRs from the VPC.</p>
          <p>The core split is <b>public vs private subnet</b> — not a property of the subnet itself, but of the route table attached to it:</p>
          <ul>
            <li><b>Public subnet</b> = route table has <code>0.0.0.0/0 → Internet Gateway</code>, instances have public IPs.</li>
            <li><b>Private subnet</b> = route table has <code>0.0.0.0/0 → NAT Gateway</code> (or TGW/VPN), no public IPs.</li>
            <li><b>Isolated subnet</b> = no default route at all; uses VPC endpoints for AWS APIs.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'Classic three-tier VPC across two AZs', ascii: `
  VPC 10.20.0.0/16                              Internet
                                                   │
                     ┌────────── Internet Gateway ──────────┐
                     │                                      │
   ┌─── AZ a ───┐    │   ┌─── AZ b ───┐                     │
   │ Public  /24│────┘   │ Public  /24│─────────────────────┘
   │ NAT-GW a   │        │ NAT-GW b   │
   └─────┬──────┘        └─────┬──────┘
         │                     │
   ┌─────┴──────┐        ┌─────┴──────┐
   │ Private /24│        │ Private /24│    app tier
   └────────────┘        └────────────┘
   ┌────────────┐        ┌────────────┐
   │ DB /24     │        │ DB /24     │    isolated tier
   └────────────┘        └────────────┘
` },
        { kind: 'cli', title: 'Create a minimal VPC with AWS CLI', code: `# VPC
aws ec2 create-vpc --cidr-block 10.20.0.0/16 \\
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=prod-eu-west-1}]'

# Internet Gateway + attach
aws ec2 create-internet-gateway \\
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=prod-igw}]'
aws ec2 attach-internet-gateway --internet-gateway-id igw-xxx --vpc-id vpc-xxx

# Public subnets (one per AZ)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.20.0.0/24  --availability-zone eu-west-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.20.1.0/24  --availability-zone eu-west-1b

# NAT Gateway (public-subnet A, EIP required)
aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id subnet-pub-a --allocation-id eipalloc-xxx

# Public route table
aws ec2 create-route-table --vpc-id vpc-xxx
aws ec2 create-route --route-table-id rtb-pub --destination-cidr-block 0.0.0.0/0 --gateway-id igw-xxx
aws ec2 associate-route-table --route-table-id rtb-pub --subnet-id subnet-pub-a

# Private route table
aws ec2 create-route-table --vpc-id vpc-xxx
aws ec2 create-route --route-table-id rtb-priv --destination-cidr-block 0.0.0.0/0 --nat-gateway-id nat-xxx
aws ec2 associate-route-table --route-table-id rtb-priv --subnet-id subnet-priv-a`},
        { kind: 'callout', level: 'warn', title: 'NAT Gateways are the silent cost assassin', body: 'A single NAT Gateway in <i>eu-west-1</i> is ~$32/month + $0.045/GB processed. A chatty private subnet talking to S3 over the public API can rack up hundreds of dollars per month in NAT charges <b>alone</b>. Always pair with <b>S3/DynamoDB Gateway VPC Endpoints</b> (free) and Interface Endpoints for frequently-used APIs.' },
        { kind: 'table', title: 'CIDR reservations inside every subnet', headers: ['IP', 'Reserved for'], rows: [
          ['.0','Network address'],
          ['.1','VPC router (default gateway)'],
          ['.2','DNS resolver (base of VPC CIDR)'],
          ['.3','Reserved for future use'],
          ['.255','Broadcast (not used, but reserved)']
        ]}
      ]
    },

    {
      id: 'sg-nacl',
      title: 'Security Groups & NACLs',
      icon: '🛡️',
      tagline: 'Stateful SGs at the instance, stateless NACLs at the subnet — and when to use each.',
      sections: [
        { kind: 'prose', html: `
          <p>AWS gives you two layers of network filtering:</p>
          <ul>
            <li><b>Security Groups (SG)</b> — stateful, attached to ENIs. Allow-only (no explicit deny). Return traffic is automatic. Rules can reference <i>other SGs</i> as sources — the killer feature.</li>
            <li><b>Network ACLs (NACL)</b> — stateless, attached to subnets. Allow + deny, numbered priority (lowest first, default 100-based). Return traffic requires its own rule. Mostly used as a deny-only safety net.</li>
          </ul>
          <p>Most workloads only need SGs. NACLs come out when compliance demands subnet-level explicit deny (e.g. "never allow 3389 from anywhere at the subnet level"), or when you need cheap, coarse blackhole filtering without paying for a firewall.</p>
        `},
        { kind: 'diagram', title: 'Flow through SG and NACL', ascii: `
   Inbound packet
        │
        ▼
   ┌──────────────────┐
   │ NACL (subnet)    │   evaluated low-number-first, first match wins
   │  - allow / deny  │   stateless — return flow has its own rule
   └──────┬───────────┘
          ▼
   ┌──────────────────┐
   │ SG (ENI)         │   allow-only, stateful
   │  - allow rules   │   implicit deny at the end
   └──────┬───────────┘
          ▼
      Instance
` },
        { kind: 'cli', title: 'SG that references another SG (the right way)', code: `# Web-tier SG allows 443 from the world.
aws ec2 create-security-group --vpc-id vpc-xxx --group-name web --description "Public web"
aws ec2 authorize-security-group-ingress --group-id sg-web \\
    --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id sg-web \\
    --protocol tcp --port 80  --cidr 0.0.0.0/0

# App-tier SG allows 8080 ONLY from the web SG — not an IP range.
aws ec2 create-security-group --vpc-id vpc-xxx --group-name app --description "App tier"
aws ec2 authorize-security-group-ingress --group-id sg-app \\
    --protocol tcp --port 8080 --source-group sg-web

# DB-tier SG allows 5432 ONLY from the app SG.
aws ec2 create-security-group --vpc-id vpc-xxx --group-name db --description "DB tier"
aws ec2 authorize-security-group-ingress --group-id sg-db \\
    --protocol tcp --port 5432 --source-group sg-app`},
        { kind: 'callout', level: 'tip', title: 'Reference SGs, not IPs — always', body: 'When tier A needs to reach tier B, write the rule as "allow from sg-A" instead of "allow from 10.20.0.0/24". Instances can be rebuilt, rescheduled, auto-scaled — the SG reference keeps working. IP-based SG rules rot silently as the subnet refills.' },
        { kind: 'table', title: 'SG vs NACL cheat sheet', headers: ['Dimension','SG','NACL'], rows: [
          ['Scope','ENI','Subnet'],
          ['Stateful?','Yes','No'],
          ['Default','Deny all in; allow all out','Allow all in and out'],
          ['Rule actions','Allow only','Allow + Deny'],
          ['Rule order','No order (all evaluated)','Numbered priority, first match wins'],
          ['Source types','CIDR, SG, prefix list','CIDR only'],
          ['Max rules','60 per SG (soft)','20 per NACL (hard, request raise)']
        ]}
      ]
    },

    {
      id: 'transit-gateway',
      title: 'Transit Gateway',
      icon: '🕸️',
      tagline: 'Hub-and-spoke at Region scale — VPC attachments, route tables, propagation, sharing.',
      sections: [
        { kind: 'prose', html: `
          <p>A <b>Transit Gateway (TGW)</b> is a regional routing hub that replaces full-mesh VPC peering. Every attachment (VPC, VPN, Direct Connect, TGW Peering, Connect) becomes a routable spoke, and you segment traffic via <b>TGW route tables</b>. Think "cloud IXP".</p>
          <p>Two table actions matter:</p>
          <ul>
            <li><b>Association</b> — this attachment <i>uses</i> this route table for its outbound lookups.</li>
            <li><b>Propagation</b> — this attachment <i>advertises</i> its routes into this route table.</li>
          </ul>
          <p>The standard pattern is "production attachments propagate into the <code>prod</code> RT and are associated with it; dev propagates into <code>dev</code> and is associated with it; neither can reach the other". A <code>shared-services</code> RT propagates into both.</p>
        `},
        { kind: 'diagram', title: 'A mature TGW topology', ascii: `
                      ┌──────── Transit Gateway ────────┐
                      │                                 │
   VPC-prod-A ───────▶│                                 │◀─── VPC-prod-B
                      │     RT: prod                    │
                      │   ┌────────────────┐            │
   VPC-dev-A ───────▶ │   │                │            │◀─── VPC-dev-B
                      │   RT: dev          │            │
                      │                    │            │
   On-prem (DX/VPN)──▶│   RT: shared-svcs  │            │
                      │                                 │
                      └────────┬────────────────────────┘
                               │
                               └── TGW Peering (inter-Region)
` },
        { kind: 'cli', title: 'Build a TGW with two VPC attachments and segmentation', code: `# 1. TGW
aws ec2 create-transit-gateway --description "prod-hub" \\
  --options AmazonSideAsn=64512,AutoAcceptSharedAttachments=enable,DefaultRouteTableAssociation=disable,DefaultRouteTablePropagation=disable

# 2. Route tables — one per segment.
aws ec2 create-transit-gateway-route-table --transit-gateway-id tgw-xxx \\
  --tag-specifications 'ResourceType=transit-gateway-route-table,Tags=[{Key=Name,Value=rt-prod}]'
aws ec2 create-transit-gateway-route-table --transit-gateway-id tgw-xxx \\
  --tag-specifications 'ResourceType=transit-gateway-route-table,Tags=[{Key=Name,Value=rt-shared}]'

# 3. Attachments.
aws ec2 create-transit-gateway-vpc-attachment --transit-gateway-id tgw-xxx \\
  --vpc-id vpc-prod --subnet-ids subnet-a subnet-b

# 4. Associate + propagate.
aws ec2 associate-transit-gateway-route-table --transit-gateway-route-table-id rt-prod \\
  --transit-gateway-attachment-id tgw-att-prod
aws ec2 enable-transit-gateway-route-table-propagation --transit-gateway-route-table-id rt-prod \\
  --transit-gateway-attachment-id tgw-att-prod
aws ec2 enable-transit-gateway-route-table-propagation --transit-gateway-route-table-id rt-shared \\
  --transit-gateway-attachment-id tgw-att-prod   # reach shared services

# 5. VPC route tables need a static route via the TGW.
aws ec2 create-route --route-table-id rtb-prod-priv \\
  --destination-cidr-block 10.0.0.0/8 --transit-gateway-id tgw-xxx`},
        { kind: 'callout', level: 'warn', title: 'Appliance Mode for stateful inspection', body: 'If you send traffic through a stateful middlebox (firewall, IDS) that lives in one VPC, enable <b>appliance-mode</b> on that attachment. Without it, TGW picks a random AZ for each direction and your firewall sees only half of the flow — debug hell.' },
        { kind: 'table', title: 'TGW attachment types', headers: ['Type','Use case'], rows: [
          ['VPC','Spoke VPCs'],
          ['VPN','Site-to-site IPsec'],
          ['Direct Connect Gateway','ExpressRoute equivalent'],
          ['TGW Peering','Inter-Region connectivity'],
          ['TGW Connect','SD-WAN appliances via GRE+BGP']
        ]}
      ]
    },

    {
      id: 'elb',
      title: 'Elastic Load Balancing',
      icon: '⚖️',
      tagline: 'ALB vs NLB vs GWLB vs CLB — pick the right one or regret it.',
      sections: [
        { kind: 'prose', html: `
          <p>AWS has four load balancer types. Three are current, one is legacy.</p>
          <ul>
            <li><b>ALB (Application)</b> — L7 HTTP/HTTPS/gRPC/WebSocket. Path and host routing, SNI for many certs, AuthZ integration, WAF association, native target types: instance, IP, Lambda, container.</li>
            <li><b>NLB (Network)</b> — L4 TCP/UDP/TLS. Millions of requests/s, static IP per AZ, preserves source IP, cross-zone optional.</li>
            <li><b>GWLB (Gateway)</b> — L3 transparent insertion for third-party firewalls / NDR via GENEVE tunnels. Forms "service chains".</li>
            <li><b>CLB (Classic)</b> — deprecated for new workloads, EC2-Classic legacy only.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'Choosing between ALB and NLB', ascii: `
                            ┌─────────────────────┐
       HTTP / HTTPS         │                     │
       Host/Path routing    │         ALB         │
       WAF, auth            │  (L7 App-aware)     │
                            └─────────────────────┘

                            ┌─────────────────────┐
       TCP / UDP / TLS      │                     │
       Static IP            │         NLB         │
       Extreme perf         │  (L4 Transport)     │
       Preserve src IP      │                     │
                            └─────────────────────┘
` },
        { kind: 'cli', title: 'Provision an ALB with a target group and HTTPS listener', code: `# Target group (instance type, port 8080, HTTP health check /healthz)
aws elbv2 create-target-group --name app-tg --protocol HTTP --port 8080 \\
    --vpc-id vpc-xxx --target-type instance --health-check-path /healthz \\
    --matcher HttpCode=200

# ALB — needs two public subnets, an SG that allows 443 from the world
aws elbv2 create-load-balancer --name app-alb --type application \\
    --subnets subnet-pub-a subnet-pub-b --security-groups sg-alb-public

# HTTPS listener with ACM cert, forward to the target group
aws elbv2 create-listener --load-balancer-arn <alb-arn> --protocol HTTPS --port 443 \\
    --certificates CertificateArn=<acm-arn> \\
    --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \\
    --default-actions Type=forward,TargetGroupArn=<tg-arn>

# Redirect 80 → 443
aws elbv2 create-listener --load-balancer-arn <alb-arn> --protocol HTTP --port 80 \\
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'`},
        { kind: 'callout', level: 'tip', title: 'Cross-zone load balancing costs money on NLB', body: 'ALB has cross-zone on by default and free. NLB defaults to OFF (cheaper data-transfer) — traffic that arrives in AZ-a only goes to targets in AZ-a. Enable cross-zone on NLB for resilience when target pool is small, but expect inter-AZ data-transfer charges.' },
        { kind: 'table', title: 'ELB capability matrix', headers: ['Capability','ALB','NLB','GWLB'], rows: [
          ['Layer','7','4','3'],
          ['Protocols','HTTP, HTTPS, gRPC, WS','TCP, UDP, TLS','IP (GENEVE)'],
          ['Path/Host routing','Yes','No','No'],
          ['Static IP','No','Yes (per AZ)','Yes (ENI)'],
          ['Preserves source IP','No (X-Forwarded-For)','Yes','Yes'],
          ['WAF','Yes','No','No (via ALB)'],
          ['Typical use','APIs, web apps','Game servers, TCP services','Firewall / NDR insertion']
        ]}
      ]
    },

    {
      id: 'vpn-direct-connect',
      title: 'Site-to-Site VPN & Direct Connect',
      icon: '🔗',
      tagline: 'IPsec over the internet; dedicated fibre via Direct Connect; DXGW for multi-region.',
      sections: [
        { kind: 'prose', html: `
          <p>Two ways to pin an on-premises network to AWS:</p>
          <ul>
            <li><b>Site-to-Site VPN</b> — IPsec tunnels over the internet. Always two tunnels per connection for redundancy, BGP preferred over static. Good for branch offices or DX backup.</li>
            <li><b>Direct Connect (DX)</b> — dedicated physical cross-connect from your rack/cage in a DX location to AWS. 1/10/100 Gbps. Private, predictable latency, lower $/GB beyond a threshold.</li>
          </ul>
          <p>Both terminate on either a <b>Virtual Private Gateway</b> (VGW, legacy, single VPC) or a <b>Transit Gateway</b> (modern, many VPCs via DXGW).</p>
        `},
        { kind: 'diagram', title: 'Resilient DX + VPN backup to a TGW', ascii: `
   Corp DC ───┬── Direct Connect location A ──▶ DX private VIF ─┐
              │                                                  ├─▶ Direct Connect Gateway ─▶ TGW ─▶ VPCs
              └── Direct Connect location B ──▶ DX private VIF ─┘

   Corp DC ───── Internet ─── IPsec tunnel 1 ──┐
                           └── IPsec tunnel 2 ──┴─▶ TGW (as backup path, lower BGP pref)
` },
        { kind: 'cli', title: 'BGP-based S2S VPN to a TGW', code: `# 1. Customer Gateway (your side)
aws ec2 create-customer-gateway --bgp-asn 65000 --public-ip 203.0.113.1 --type ipsec.1

# 2. VPN connection attached to TGW
aws ec2 create-vpn-connection --customer-gateway-id cgw-xxx --type ipsec.1 \\
    --transit-gateway-id tgw-xxx \\
    --options TunnelOptions='[{TunnelInsideCidr=169.254.44.0/30},{TunnelInsideCidr=169.254.44.4/30}]'

# 3. Associate + propagate the VPN attachment into a TGW route table
aws ec2 associate-transit-gateway-route-table \\
    --transit-gateway-route-table-id rt-shared \\
    --transit-gateway-attachment-id tgw-att-vpn
aws ec2 enable-transit-gateway-route-table-propagation \\
    --transit-gateway-route-table-id rt-shared \\
    --transit-gateway-attachment-id tgw-att-vpn

# 4. Download config for your firewall
aws ec2 describe-vpn-connections --vpn-connection-ids vpn-xxx \\
    --query 'VpnConnections[].CustomerGatewayConfiguration' --output text`},
        { kind: 'callout', level: 'warn', title: 'DX single connection = single point of failure', body: 'A single DX port is not redundant — scheduled maintenance or a fibre cut kills the link. For production use two DX connections at <b>different DX locations</b>, with BGP on both, and optionally an S2S VPN as tertiary backup (higher BGP weight on VPN so it is a last resort).' },
        { kind: 'table', title: 'VPN vs Direct Connect', headers: ['Attribute','VPN','DX'], rows: [
          ['Transport','Internet + IPsec','Dedicated fibre / MPLS partner'],
          ['Typical bandwidth','Up to 1.25 Gbps per tunnel','1 / 10 / 100 Gbps'],
          ['Latency','Variable (internet)','Consistent (private path)'],
          ['Setup time','Minutes','Weeks (physical install)'],
          ['$/GB beyond transfer','Public internet egress','DX data transfer rate (cheaper)'],
          ['Private?','Encrypted, but over the internet','Private L2 cross-connect']
        ]}
      ]
    },

    {
      id: 'route53',
      title: 'Route 53 DNS',
      icon: '🗺️',
      tagline: 'Public and private hosted zones, routing policies, health checks, Resolver endpoints.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Route 53</b> is AWS's managed DNS. You get two zone types:</p>
          <ul>
            <li><b>Public hosted zone</b> — internet-facing, your domain. Free 50 zones per account by default.</li>
            <li><b>Private hosted zone (PHZ)</b> — resolvable only from associated VPCs. Ideal for internal <code>corp.aws</code> naming.</li>
          </ul>
          <p>The routing policies are where Route 53 shines:</p>
          <ul>
            <li><b>Simple</b> — one record, one answer.</li>
            <li><b>Weighted</b> — canary rollouts (95% to v1, 5% to v2).</li>
            <li><b>Latency</b> — DNS resolves to the Region with the lowest measured latency for the client.</li>
            <li><b>Failover</b> — primary/secondary with a Health Check.</li>
            <li><b>Geolocation / Geoproximity</b> — answer by country/continent/bias.</li>
            <li><b>Multi-value</b> — returns up to 8 healthy records (poor-man's LB).</li>
          </ul>
        `},
        { kind: 'cli', title: 'A weighted canary and a failover pair', code: `# Weighted: 95/5 rollout
aws route53 change-resource-record-sets --hosted-zone-id Zxxx --change-batch '{
  "Changes": [
    {"Action":"UPSERT","ResourceRecordSet":{
       "Name":"api.example.com","Type":"A","SetIdentifier":"v1","Weight":95,"AliasTarget":{
         "HostedZoneId":"Zxxx","DNSName":"v1.alb.amazonaws.com","EvaluateTargetHealth":true}}},
    {"Action":"UPSERT","ResourceRecordSet":{
       "Name":"api.example.com","Type":"A","SetIdentifier":"v2","Weight":5,"AliasTarget":{
         "HostedZoneId":"Zxxx","DNSName":"v2.alb.amazonaws.com","EvaluateTargetHealth":true}}}]}'

# Failover: primary + secondary with health check
aws route53 create-health-check --caller-reference "$(date +%s)" \\
    --health-check-config 'Type=HTTPS,FullyQualifiedDomainName=app.example.com,Port=443,ResourcePath=/healthz,RequestInterval=30,FailureThreshold=3'`},
        { kind: 'prose', html: `
          <h4>Route 53 Resolver — hybrid DNS done right</h4>
          <p>When VPC resources need to resolve on-prem names (or vice versa) use <b>Resolver endpoints</b>:</p>
          <ul>
            <li><b>Inbound endpoint</b> — on-prem resolvers forward <i>AWS PHZ</i> queries here.</li>
            <li><b>Outbound endpoint</b> — VPC resolvers forward <i>on-prem</i> queries out via Resolver Rules.</li>
          </ul>
          <p>Combine with <b>Resolver rules</b> to control which domains are forwarded to which targets. Share via RAM for multi-account.</p>
        `},
        { kind: 'callout', level: 'tip', title: 'Alias records beat CNAMEs for AWS targets', body: 'Alias A/AAAA records are free, work at the zone apex (CNAMEs cannot), and support EvaluateTargetHealth for auto-failover. Always use Alias when pointing at an ALB/NLB/CloudFront/S3 website/API Gateway — CNAMEs only when the target is outside AWS.' }
      ]
    },

    {
      id: 'privatelink',
      title: 'VPC Endpoints & PrivateLink',
      icon: '🔒',
      tagline: 'Reach AWS services without traversing the public internet — Gateway, Interface, and Endpoint Services.',
      sections: [
        { kind: 'prose', html: `
          <p>You do not need a NAT Gateway to reach AWS APIs. <b>VPC Endpoints</b> give private connectivity:</p>
          <ul>
            <li><b>Gateway endpoints</b> — free, route-table entry only. Only for <b>S3</b> and <b>DynamoDB</b>. Use them always.</li>
            <li><b>Interface endpoints (PrivateLink)</b> — ENIs in your subnet with DNS names that override the public endpoint. Priced per-hour + per-GB.</li>
            <li><b>Endpoint Services</b> — turn your own NLB/GWLB into a PrivateLink service others consume via Interface endpoints. Cross-account SaaS delivery without peering.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'Interface endpoint vs NAT path to S3', ascii: `
   Without endpoint:                With Gateway endpoint (free):
   EC2 ─▶ NAT-GW ─▶ IGW ─▶ S3       EC2 ─▶ Route to S3 prefix list ─▶ S3
   [$ per GB]                       [0 $ — stays on AWS backbone]

   Interface endpoint (KMS, SSM, Secrets Manager, etc.):
   EC2 ──────── ENI (endpoint) ──────▶ Service
                [private DNS overrides public FQDN]
` },
        { kind: 'cli', title: 'Create a gateway endpoint for S3 and interface endpoints for SSM', code: `# Gateway endpoint — attach to route tables, done.
aws ec2 create-vpc-endpoint --vpc-id vpc-xxx --service-name com.amazonaws.eu-west-1.s3 \\
    --vpc-endpoint-type Gateway \\
    --route-table-ids rtb-priv-a rtb-priv-b

# Interface endpoints for SSM Session Manager (no public IP needed on instances).
for svc in ssm ssmmessages ec2messages; do
  aws ec2 create-vpc-endpoint --vpc-id vpc-xxx \\
      --service-name com.amazonaws.eu-west-1.$svc \\
      --vpc-endpoint-type Interface \\
      --subnet-ids subnet-priv-a subnet-priv-b \\
      --security-group-ids sg-endpoints \\
      --private-dns-enabled
done`},
        { kind: 'callout', level: 'warn', title: 'Endpoint policies and service policies both apply', body: 'An interface endpoint has its own <b>endpoint policy</b> that restricts what can be called through it (e.g. only allow access to buckets owned by this Organization). It combines with the service-side policy using AND. Forget the endpoint policy and you lose defense-in-depth.' }
      ]
    },

    {
      id: 'cloudfront-edge',
      title: 'CloudFront & Global Accelerator',
      icon: '🌍',
      tagline: 'Move your front door to the edge — caching, TLS termination, Anycast.',
      sections: [
        { kind: 'prose', html: `
          <p><b>CloudFront</b> is AWS's CDN — HTTP-based caching at 400+ edge locations. Terminates TLS at the edge using ACM certs, runs WAF, routes by path to <i>origins</i> (ALB, S3, EC2, on-prem, or custom HTTP). Huge wins for static content, TLS offload, and DDoS absorption.</p>
          <p><b>Global Accelerator</b> is TCP/UDP — it gives you two static Anycast IPs announced from every AWS edge location. Clients connect to the nearest edge, which traverses the AWS backbone to your nearest healthy endpoint (ALB/NLB/EC2/EIP). Use for non-HTTP workloads (gaming, VoIP, pre-authenticated APIs) where CloudFront does not apply.</p>
        `},
        { kind: 'diagram', title: 'CloudFront in front of multi-region ALBs', ascii: `
   Clients worldwide
        │
        ▼
   ┌──────────── CloudFront ────────────┐
   │  edge caches + WAF + TLS 1.3       │
   └─────────┬───────────────────┬──────┘
             │                   │
        path /api/*         path /static/*
             │                   │
             ▼                   ▼
       ALB us-east-1        S3 static bucket (OAC)
       ALB eu-west-1
           (origin group — failover)
` },
        { kind: 'cli', title: 'Minimal CloudFront distribution with an ALB origin', code: `aws cloudfront create-distribution --distribution-config '{
  "CallerReference":"'$(date +%s)'",
  "Comment":"api edge",
  "Enabled":true,
  "Origins":{"Quantity":1,"Items":[{
    "Id":"alb-origin",
    "DomainName":"app-alb-xxx.eu-west-1.elb.amazonaws.com",
    "CustomOriginConfig":{"HTTPPort":80,"HTTPSPort":443,"OriginProtocolPolicy":"https-only","OriginSslProtocols":{"Quantity":1,"Items":["TLSv1.2"]}}
  }]},
  "DefaultCacheBehavior":{
    "TargetOriginId":"alb-origin",
    "ViewerProtocolPolicy":"redirect-to-https",
    "CachePolicyId":"4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId":"88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
  },
  "ViewerCertificate":{"CloudFrontDefaultCertificate":true}
}'`},
        { kind: 'callout', level: 'tip', title: 'Use a managed cache policy — do not roll your own', body: 'AWS publishes managed CachePolicy / OriginRequestPolicy / ResponseHeadersPolicy IDs. They are updated centrally, documented, and behave predictably. Custom cache keys and header forwarding cause 90% of CloudFront debugging sessions — start managed and only customise when you measure a specific need.' }
      ]
    },

    {
      id: 'network-firewall',
      title: 'Network Firewall & WAF',
      icon: '🔥',
      tagline: 'Stateful L3/L4 inspection with Suricata rules; L7 WAF in front of ALB/CloudFront.',
      sections: [
        { kind: 'prose', html: `
          <p><b>AWS Network Firewall</b> is a managed stateful + stateless firewall — Suricata-compatible rule syntax, with managed rule groups for threat intelligence. It deploys as endpoints in your VPC; route traffic to it explicitly (typically between ingress IGW and public subnet, or at the spoke-to-TGW boundary).</p>
          <p><b>AWS WAF</b> is HTTP-layer — attach to ALB, CloudFront, API Gateway, AppSync, Cognito. Managed rule groups from AWS, Marketplace vendors, and your own custom rules (geo, rate-based, header regex, bot-control).</p>
        `},
        { kind: 'diagram', title: 'Centralised egress with Network Firewall', ascii: `
   Spoke VPCs (via TGW) ──▶ TGW ──▶ Inspection VPC
                                    ┌───────────────────┐
                                    │  subnet-fw-a      │
                                    │  NetFW endpoint ──┼── IGW ──▶ internet
                                    │  subnet-fw-b      │
                                    │  NetFW endpoint ──┘
                                    └───────────────────┘
` },
        { kind: 'cli', title: 'A stateful rule group that blocks high-risk domains', code: `# Rule group (Suricata-compatible)
aws network-firewall create-rule-group --rule-group-name block-bad-hosts \\
    --type STATEFUL --capacity 100 \\
    --rule-group '{
      "RulesSource": {
        "RulesString": "drop http any any -> any any (msg:\\"block example-bad\\"; http.host; content:\\"example-bad.com\\"; sid:1000001; rev:1;)\\ndrop tls any any -> any any (msg:\\"block sni\\"; tls.sni; content:\\"evil.example\\"; sid:1000002; rev:1;)"
      }
    }'

# Firewall policy that uses the rule group
aws network-firewall create-firewall-policy --firewall-policy-name prod-egress-policy \\
    --firewall-policy '{
      "StatelessDefaultActions":["aws:forward_to_sfe"],
      "StatelessFragmentDefaultActions":["aws:forward_to_sfe"],
      "StatefulRuleGroupReferences":[{"ResourceArn":"<rule-group-arn>"}]
    }'

# Firewall in two AZ subnets
aws network-firewall create-firewall --firewall-name prod-egress \\
    --firewall-policy-arn <policy-arn> --vpc-id vpc-inspection \\
    --subnet-mappings SubnetId=subnet-fw-a SubnetId=subnet-fw-b`},
        { kind: 'callout', level: 'tip', title: 'Start with managed rule groups, not custom', body: 'AWS Managed Rules for WAF cover OWASP Top 10, known-bad inputs, IP reputation, bot control, and more. Deploy them in <b>count mode</b> first, observe logs for false positives, then switch to block. Custom rules are a long tail — only write them when managed rules leave a gap you can describe in one sentence.' }
      ]
    },

    {
      id: 'iam-for-network',
      title: 'IAM for Network Engineers',
      icon: '🔑',
      tagline: 'The policies that gate SGs, VPC sharing, TGW attachments, and Route 53 changes.',
      sections: [
        { kind: 'prose', html: `
          <p>You will not deploy networks by hand — pipelines will. That means writing IAM for humans (read-only roles for SREs), automation (Terraform/CodeBuild assume-role), and for cross-account resource-sharing. A tight IAM baseline prevents most "who changed the SG at 3am" incidents.</p>
          <p>Three policy mechanisms that interact:</p>
          <ul>
            <li><b>Identity policies</b> — attached to IAM users/roles. Default: deny.</li>
            <li><b>Resource policies</b> — attached to the resource (VPC endpoint policy, S3 bucket policy, KMS key policy).</li>
            <li><b>Service Control Policies (SCPs)</b> — attached at the Organizations OU/account. Ceiling on what <i>any</i> principal in the account can do.</li>
          </ul>
        `},
        { kind: 'cli', title: 'A narrow IAM policy for a network-edits automation role', code: `{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"ReadVPC",
      "Effect":"Allow",
      "Action":[
        "ec2:Describe*",
        "elasticloadbalancing:Describe*",
        "route53:List*","route53:Get*"
      ],
      "Resource":"*"
    },
    {
      "Sid":"EditSGsTaggedAutomation",
      "Effect":"Allow",
      "Action":[
        "ec2:AuthorizeSecurityGroup*",
        "ec2:RevokeSecurityGroup*",
        "ec2:UpdateSecurityGroupRuleDescriptions*"
      ],
      "Resource":"arn:aws:ec2:*:*:security-group/*",
      "Condition":{"StringEquals":{"aws:ResourceTag/ManagedBy":"terraform"}}
    }
  ]
}`},
        { kind: 'callout', level: 'warn', title: 'SCPs are ceilings, not grants', body: 'An SCP that <b>allows</b> something does not grant anyone access — it just removes the ceiling. You still need identity/resource policies that allow the action. A common "why can I not do X" moment: IAM says allow, SCP silently denies via an explicit deny higher up.' }
      ]
    },

    {
      id: 'observability',
      title: 'Observability & Diagnostics',
      icon: '🔎',
      tagline: 'VPC Flow Logs, Traffic Mirroring, Reachability Analyzer, Network Access Analyzer, CloudWatch.',
      sections: [
        { kind: 'prose', html: `
          <p>AWS gives you first-class tools to see what is happening without tcpdump. In priority order for day-to-day ops:</p>
          <ul>
            <li><b>VPC Flow Logs</b> — per-ENI/subnet/VPC flow records (5-tuple, action, bytes, packets). To S3 or CloudWatch Logs. Default format, extended format with more fields, or custom.</li>
            <li><b>VPC Reachability Analyzer</b> — static analysis: "can source X reach destination Y right now?" Identifies the specific component blocking traffic.</li>
            <li><b>VPC Network Access Analyzer</b> — continuous "who <i>can</i> reach what" — compliance-friendly.</li>
            <li><b>Traffic Mirroring</b> — SPAN-style copy of ENI traffic to a target for an NDR, packet broker, or Wireshark host.</li>
            <li><b>CloudWatch Metrics & Alarms</b> — per-ELB, per-TGW, per-Direct-Connect, per-VPN metrics; plus Contributor Insights for top talkers.</li>
          </ul>
        `},
        { kind: 'cli', title: 'Enable Flow Logs to S3 with extended fields', code: `aws ec2 create-flow-logs \\
    --resource-type VPC --resource-ids vpc-xxx \\
    --traffic-type ALL \\
    --log-destination-type s3 \\
    --log-destination arn:aws:s3:::prod-flowlogs \\
    --log-format '\${version} \${vpc-id} \${subnet-id} \${interface-id} \${srcaddr} \${dstaddr} \${srcport} \${dstport} \${protocol} \${packets} \${bytes} \${start} \${end} \${action} \${log-status} \${tcp-flags} \${flow-direction} \${pkt-src-aws-service} \${pkt-dst-aws-service}'`},
        { kind: 'cli', title: 'Reachability Analyzer — find why traffic fails', code: `# Create and run a path analysis
aws ec2 create-network-insights-path --source eni-client --destination eni-server \\
    --protocol tcp --destination-port 443
aws ec2 start-network-insights-analysis --network-insights-path-id nip-xxx

# When done, get the verdict
aws ec2 describe-network-insights-analyses --network-insights-analysis-ids nia-xxx \\
    --query 'NetworkInsightsAnalyses[0].Explanations'`},
        { kind: 'callout', level: 'tip', title: 'Reachability Analyzer first, Flow Logs second', body: 'When a flow "does not work", run Reachability Analyzer before you open Flow Logs. It returns the exact component that blocks the path — SG, NACL, route table, missing TGW route — in under a minute, for free. Flow Logs confirm behaviour <b>after</b> you have fixed the config.' }
      ]
    },

    {
      id: 'iac',
      title: 'Infrastructure as Code',
      icon: '📜',
      tagline: 'CloudFormation, CDK, Terraform — what to pick and how to structure network modules.',
      sections: [
        { kind: 'prose', html: `
          <p>Three real choices (plus a handful of niche tools):</p>
          <ul>
            <li><b>CloudFormation</b> — native, no drift risk with AWS, YAML/JSON. Good for AWS-only shops.</li>
            <li><b>CDK</b> — write infra in Python/TypeScript/Java, compiles to CloudFormation. Best for teams fluent in a real language.</li>
            <li><b>Terraform (AWS Provider)</b> — HCL, multi-cloud, largest ecosystem. Most network teams standardise here.</li>
          </ul>
          <p>Shape your IaC repos around <b>network layers</b>, not accounts: a <code>core-network</code> module (TGW, DX, shared DNS), a <code>vpc</code> module (per workload), an <code>app</code> module (SGs, ALB, target groups, tasks). Pin the module version — network IaC is the last place you want "latest".</p>
        `},
        { kind: 'cli', title: 'Terraform: VPC + subnets + NAT + route tables', code: `terraform {
  required_version = ">= 1.6"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.1"

  name = "prod-eu-west-1"
  cidr = "10.20.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
  public_subnets  = ["10.20.0.0/24", "10.20.1.0/24", "10.20.2.0/24"]
  private_subnets = ["10.20.10.0/24", "10.20.11.0/24", "10.20.12.0/24"]
  intra_subnets   = ["10.20.20.0/24", "10.20.21.0/24", "10.20.22.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_flow_log      = true
  flow_log_destination_type = "s3"
  flow_log_destination_arn  = "arn:aws:s3:::prod-flowlogs"

  tags = { Environment = "prod", ManagedBy = "terraform" }
}`},
        { kind: 'callout', level: 'tip', title: 'State lives in S3 + DynamoDB, locked', body: 'Never share Terraform state by Slack. Use an S3 backend with encryption + versioning, plus a DynamoDB table for state locking. The first concurrent <code>terraform apply</code> that lost its hands to a cowboy edit is the last time your team trusts IaC.' }
      ]
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting Toolkit',
      icon: '🩺',
      tagline: 'The commands and services you reach for when traffic does not flow.',
      sections: [
        { kind: 'prose', html: `
          <p>A triage ladder for "X cannot reach Y" in AWS:</p>
          <ol>
            <li><b>Reachability Analyzer</b> — ask the platform itself. It reads SG, NACL, routes, TGW, endpoints, firewall — tells you what blocks.</li>
            <li><b>Effective routes on the ENI</b> — <code>describe-network-interfaces</code> + route-table lookup.</li>
            <li><b>SG/NACL rules</b> — list rules and identify which would match.</li>
            <li><b>VPC Flow Logs</b> — was there a flow? ACCEPT / REJECT?</li>
            <li><b>Traffic Mirroring → Wireshark</b> — for the last 5% of "weird TCP".</li>
          </ol>
        `},
        { kind: 'cli', title: 'The one-minute triage', code: `# 1. Do I even have a route?
aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=subnet-xxx

# 2. What SGs does the ENI have and what do they allow?
aws ec2 describe-network-interfaces --network-interface-ids eni-xxx \\
    --query 'NetworkInterfaces[0].Groups'
aws ec2 describe-security-groups --group-ids sg-xxx

# 3. Flow Logs — is the packet even arriving?
aws logs start-query --log-group-name /aws/vpc/flow --start-time $(date -u -d '-15 min' +%s) \\
    --end-time $(date +%s) --query-string \\
    'fields @timestamp, srcAddr, dstAddr, srcPort, dstPort, action | filter srcAddr="10.0.1.50" and dstAddr="10.0.2.10" | sort @timestamp desc | limit 20'

# 4. ELB target health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# 5. TGW route — is the spoke even in the right RT?
aws ec2 search-transit-gateway-routes --transit-gateway-route-table-id rtb-xxx \\
    --filters Name=route-search.exact-match,Values=10.99.0.0/16`},
        { kind: 'callout', level: 'warn', title: 'Asymmetric routing kills stateful inspection', body: 'TGW, Network Firewall and NAT Gateways all rely on seeing both directions of a flow. If one AZ path differs from the other (missing route, different firewall AZ), half the flow is silently dropped. Use appliance-mode on the TGW attachment, and keep route tables symmetric across AZs.' },
        { kind: 'checklist', title: 'Before you escalate', items: [
          'Reachability Analyzer run between source and destination ENI',
          'Flow Logs show ACCEPT/REJECT — or nothing at all (routing issue)',
          'ELB target health green, not failing health checks',
          'TGW route table for the attachment contains the destination CIDR',
          'Confirmed the instance-level OS firewall (iptables, Windows Defender) is not the culprit',
          'Checked SCP + resource policies for deny that overrides allow',
          'MTU confirmed (jumbo? PPPoE? TCP-MSS clamping on VPN?)'
        ]}
      ]
    },

    {
      id: 'cost',
      title: 'Cost & Data-Transfer Pitfalls',
      icon: '💰',
      tagline: 'Network decisions hit the AWS bill harder than most — know the traps.',
      sections: [
        { kind: 'prose', html: `
          <p>Networking is one of the biggest surprise cost lines on an AWS bill. Most of it comes from data-transfer <i>across</i> boundaries you do not think about every day.</p>
          <ul>
            <li><b>Inter-AZ</b> traffic is $0.01/GB each direction.</li>
            <li><b>Egress to internet</b> ~$0.09/GB (first GB/month free, tiers down with volume).</li>
            <li><b>NAT Gateway processing</b> $0.045/GB on top of egress.</li>
            <li><b>Inter-Region</b> up to $0.02/GB depending on source/destination.</li>
            <li><b>VPC peering</b> within a Region is free for processing but inter-AZ still charges.</li>
          </ul>
        `},
        { kind: 'table', title: 'Common cost traps and fixes', headers: ['Symptom','Cause','Fix'], rows: [
          ['$1k NAT Gateway bill','S3/DDB traffic via NAT','Add Gateway endpoints (free)'],
          ['High inter-AZ','Chatty app talking across AZs','Pin affinity via AZ-aware routing or Availability Zone-local targets'],
          ['Mysterious egress','Public IP on private workload','Replace with Interface endpoints + SSM'],
          ['CloudWatch Logs bill spike','Flow Logs at full volume into CW Logs','Send to S3 instead (cheaper) with Glue partitioning'],
          ['Direct Connect underused','Some routes still via internet','Check BGP attributes, prefix filters, route-priority']
        ]},
        { kind: 'callout', level: 'tip', title: 'Enable Cost Anomaly Detection', body: 'Cost Anomaly Detection is free and emails you when spend on a service or account deviates from the baseline. Enable it on day one in every account, with a monitor grouped by Service — the 48-hour warning has paid for itself in every production environment I have ever worked on.' }
      ]
    }
  ]
};
