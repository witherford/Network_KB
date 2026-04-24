// Curriculum for the Microsoft Azure learning centre — network-engineer focused.

export const CURRICULUM = {
  id: 'azure',
  title: 'Microsoft Azure',
  tagline: 'Azure for network engineers — VNets, NSGs, Azure Firewall, VPN, ExpressRoute, Virtual WAN, Private Link, observability.',
  vendor: 'Microsoft',
  platform: 'Azure',
  badge: 'azure',
  estimatedMinutes: 270,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Core Concepts',
      icon: '🌐',
      tagline: 'Tenants, subscriptions, management groups, regions, Availability Zones, ARM.',
      sections: [
        { kind: 'prose', html: `
          <p>Azure's hierarchy from top to bottom:</p>
          <ul>
            <li><b>Tenant</b> — your Entra ID (formerly Azure AD) directory. Identity boundary.</li>
            <li><b>Management Groups</b> — nested containers for grouping subscriptions (policy + RBAC inheritance).</li>
            <li><b>Subscription</b> — billing + quota boundary. Most resources live here.</li>
            <li><b>Resource Group</b> — a lifecycle container within a subscription. Nothing crosses RGs for free.</li>
            <li><b>Resources</b> — VNets, VMs, storage, firewalls.</li>
          </ul>
          <p><b>Regions</b> are geographic locations (e.g. <code>uksouth</code>, <code>westeurope</code>). Most Regions have three <b>Availability Zones</b>. Within a Region you get <b>Region Pairs</b> — Microsoft's built-in DR buddy (e.g. uksouth ↔ ukwest). Zonal services need explicit <code>--zone</code> flags.</p>
        `},
        { kind: 'diagram', title: 'Azure hierarchy at a glance', ascii: `
   ┌────────────── Entra ID tenant ──────────────┐
   │                                             │
   │   Management Group "Corp" (root)            │
   │   ├─ MG "Security"                          │
   │   │  └─ Sub: log-archive                    │
   │   ├─ MG "Landing Zones"                     │
   │   │  ├─ Sub: prod-network                   │
   │   │  ├─ Sub: prod-app                       │
   │   │  └─ Sub: nonprod-app                    │
   │   └─ MG "Sandbox"                           │
   │      └─ Sub: sandbox-dev                    │
   └─────────────────────────────────────────────┘

   Each Subscription
     └─ Resource Groups
          └─ Resources (VNet, Firewall, VM, …)
` },
        { kind: 'callout', level: 'info', title: 'Resource Manager is the only API', body: 'All modern Azure deployments go through <b>Azure Resource Manager (ARM)</b>. You write ARM JSON, Bicep (transpiles to ARM), or Terraform (calls ARM under the hood). Portal clicks call ARM too. Everything is a PUT/PATCH/DELETE against <code>management.azure.com</code>.' },
        { kind: 'table', title: 'Services to know from day one', headers: ['Category','Service'], rows: [
          ['Compute','VM, VM Scale Sets, AKS, Container Apps, App Service'],
          ['Networking','Virtual Network, NSG, Azure Firewall, Application Gateway, Front Door, Load Balancer, Virtual WAN'],
          ['Hybrid','VPN Gateway, ExpressRoute, Azure Arc'],
          ['Storage','Storage Account (blob/file/queue/table), Azure NetApp, managed disks'],
          ['Identity','Entra ID, Entra ID B2C, managed identities'],
          ['Governance','Policy, Blueprints (deprecated → Deployment Stacks), Resource Graph'],
          ['Observability','Log Analytics, Azure Monitor, Network Watcher, Application Insights']
        ]}
      ]
    },

    {
      id: 'vnet',
      title: 'Virtual Networks (VNet)',
      icon: '🧱',
      tagline: 'Address space, subnets, delegated subnets, peering, hub-and-spoke.',
      sections: [
        { kind: 'prose', html: `
          <p>A <b>Virtual Network (VNet)</b> is an isolated private network in one region. Key properties:</p>
          <ul>
            <li>One or more IPv4 CIDR blocks (optionally IPv6). Non-overlapping across peered VNets.</li>
            <li>Subnets within the VNet — each has a default <b>system route table</b>, optionally a user-defined table (UDR) and NSG.</li>
            <li>Reserved IPs per subnet: <code>.0</code> (network), <code>.1</code> (default gateway), <code>.2</code>, <code>.3</code>, and last (broadcast) — 5 reserved.</li>
          </ul>
          <p>Connect VNets via <b>VNet peering</b> (low-latency, full-speed, non-transitive) or a <b>Virtual WAN hub</b> (transitive, scales to thousands of spokes).</p>
        `},
        { kind: 'diagram', title: 'Hub-and-spoke with VNet peering', ascii: `
                     Hub VNet (10.0.0.0/20)
                 ┌────────────────────────────┐
                 │  Azure Firewall            │
                 │  VPN Gateway / ER Gateway  │
                 │  Bastion / Private DNS     │
                 └────────┬────────┬──────────┘
               peering    │        │   peering
                          ▼        ▼
      Spoke-prod  (10.1.0.0/16)    Spoke-dev  (10.2.0.0/16)
      app/data/aks subnets          app/data subnets
` },
        { kind: 'cli', title: 'Hub VNet + firewall/gateway subnets (az CLI)', code: `# 1. Resource Group
az group create --name rg-net-hub --location uksouth

# 2. Hub VNet with a /24 space per special subnet
az network vnet create --resource-group rg-net-hub --name vnet-hub \\
    --address-prefixes 10.0.0.0/20 --location uksouth

# Firewall subnet MUST be named AzureFirewallSubnet, minimum /26
az network vnet subnet create --resource-group rg-net-hub --vnet-name vnet-hub \\
    --name AzureFirewallSubnet --address-prefixes 10.0.0.0/26

# Gateway subnet MUST be named GatewaySubnet, ideally /27
az network vnet subnet create --resource-group rg-net-hub --vnet-name vnet-hub \\
    --name GatewaySubnet --address-prefixes 10.0.1.0/27

# Bastion subnet — AzureBastionSubnet
az network vnet subnet create --resource-group rg-net-hub --vnet-name vnet-hub \\
    --name AzureBastionSubnet --address-prefixes 10.0.2.0/26

# 3. Spoke VNet
az network vnet create --resource-group rg-app-prod --name vnet-prod \\
    --address-prefixes 10.1.0.0/16 --location uksouth
az network vnet subnet create --resource-group rg-app-prod --vnet-name vnet-prod \\
    --name snet-app --address-prefixes 10.1.1.0/24

# 4. Peering (bidirectional, allow forwarded traffic, use hub's gateway)
az network vnet peering create --resource-group rg-net-hub --vnet-name vnet-hub \\
    --name hub-to-prod --remote-vnet vnet-prod --allow-vnet-access \\
    --allow-forwarded-traffic --allow-gateway-transit
az network vnet peering create --resource-group rg-app-prod --vnet-name vnet-prod \\
    --name prod-to-hub --remote-vnet vnet-hub --allow-vnet-access \\
    --allow-forwarded-traffic --use-remote-gateways`},
        { kind: 'callout', level: 'warn', title: 'Peering is non-transitive', body: 'Spoke A peered to Hub, and Spoke B peered to Hub, does NOT mean Spoke A can reach Spoke B. Either peer A↔B directly, route through the hub via UDRs pointing at Azure Firewall, or adopt Virtual WAN (which is transitive by default).' },
        { kind: 'table', title: 'Special subnets with required names', headers: ['Subnet','Required for','Minimum size'], rows: [
          ['GatewaySubnet','VPN / ExpressRoute Gateway','/27 (/29 absolute min)'],
          ['AzureFirewallSubnet','Azure Firewall','/26'],
          ['AzureFirewallManagementSubnet','Forced-tunneling Firewall','/26'],
          ['AzureBastionSubnet','Azure Bastion','/26'],
          ['RouteServerSubnet','Route Server','/27']
        ]}
      ]
    },

    {
      id: 'nsg-asg',
      title: 'NSGs & Application Security Groups',
      icon: '🛡️',
      tagline: 'Stateful L3/L4 rules at subnet or NIC level — and how ASGs replace IP-based rules.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Network Security Groups (NSG)</b> are stateful filters applied to subnets and/or NICs. Each NSG contains inbound and outbound rules with a priority (100–4096, lowest number wins).</p>
          <p><b>Application Security Groups (ASG)</b> let you tag NICs with logical names (<code>asg-web</code>, <code>asg-app</code>, <code>asg-db</code>) and write NSG rules that reference ASGs instead of IPs — just like AWS's SG-reference-SG model. This keeps rules stable as VMs churn.</p>
          <p>Azure injects <b>default rules</b> into every NSG (priority 65000+) that allow intra-VNet + load-balancer probes and deny everything else. You cannot delete them; you can only override with a higher-priority rule.</p>
        `},
        { kind: 'cli', title: 'ASG-based tier isolation', code: `# Create ASGs.
az network asg create --resource-group rg-app-prod --name asg-web --location uksouth
az network asg create --resource-group rg-app-prod --name asg-app --location uksouth
az network asg create --resource-group rg-app-prod --name asg-db  --location uksouth

# Attach ASGs to NICs (for each VM — shown for one).
az network nic ip-config update --resource-group rg-app-prod \\
    --nic-name nic-web01 --name ipconfig1 \\
    --application-security-groups asg-web

# NSG with ASG-referenced rules.
az network nsg create --resource-group rg-app-prod --name nsg-prod --location uksouth

# Web from Internet → asg-web on 443
az network nsg rule create --resource-group rg-app-prod --nsg-name nsg-prod \\
    --name allow-web-in --priority 100 --direction Inbound --access Allow \\
    --protocol Tcp --source-address-prefixes Internet --source-port-ranges '*' \\
    --destination-asgs asg-web --destination-port-ranges 443

# asg-web → asg-app on 8080
az network nsg rule create --resource-group rg-app-prod --nsg-name nsg-prod \\
    --name web-to-app --priority 110 --direction Inbound --access Allow \\
    --protocol Tcp --source-asgs asg-web --destination-asgs asg-app \\
    --destination-port-ranges 8080

# asg-app → asg-db on 1433
az network nsg rule create --resource-group rg-app-prod --nsg-name nsg-prod \\
    --name app-to-db --priority 120 --direction Inbound --access Allow \\
    --protocol Tcp --source-asgs asg-app --destination-asgs asg-db \\
    --destination-port-ranges 1433

# Attach NSG to subnet.
az network vnet subnet update --resource-group rg-app-prod --vnet-name vnet-prod \\
    --name snet-app --network-security-group nsg-prod`},
        { kind: 'callout', level: 'tip', title: 'NSGs can be applied at subnet AND NIC — both evaluate', body: 'When both are present, Azure evaluates subnet NSG first for inbound and NIC NSG first for outbound. Both have to allow or the packet is dropped. For 95% of designs, pick <b>one level</b> (subnet-only is simplest) and stick to it.' },
        { kind: 'table', title: 'NSG rule properties', headers: ['Field','Values'], rows: [
          ['Priority','100–4096 (lower wins)'],
          ['Source','IP/CIDR, ServiceTag, ASG, *'],
          ['Destination','IP/CIDR, ServiceTag, ASG, *'],
          ['Protocol','Tcp, Udp, Icmp, *'],
          ['Action','Allow, Deny'],
          ['ServiceTags','Internet, AzureCloud, Storage.uksouth, Sql, AzureLoadBalancer, …']
        ]}
      ]
    },

    {
      id: 'azure-firewall',
      title: 'Azure Firewall',
      icon: '🔥',
      tagline: 'Managed stateful NGFW — application, network, DNAT, TLS inspection, threat intelligence.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Azure Firewall</b> is a managed, stateful, cloud-native firewall. Three SKUs:</p>
          <ul>
            <li><b>Basic</b> — budget SKU, SMB branches, limited throughput (~250 Mbps).</li>
            <li><b>Standard</b> — L3/L4/L7 FQDN rules, threat-intel, FQDN tagging.</li>
            <li><b>Premium</b> — adds <b>TLS inspection</b>, <b>IDPS</b>, URL filtering, web categories.</li>
          </ul>
          <p>Rules are organised in <b>Firewall Policies</b> which are portable across firewalls. Each policy has <b>rule collection groups</b>, each containing <b>DNAT, network and application collections</b>. Evaluation order: DNAT → Network → Application; within each, priority low-to-high.</p>
        `},
        { kind: 'cli', title: 'Deploy a Standard Azure Firewall with a policy', code: `# Public IP for the firewall
az network public-ip create --name pip-afw --resource-group rg-net-hub \\
    --sku Standard --zone 1 2 3 --allocation-method Static

# Firewall policy
az network firewall policy create --resource-group rg-net-hub --name afwp-prod \\
    --sku Standard --threat-intel-mode Alert

# Rule collection group
az network firewall policy rule-collection-group create \\
    --resource-group rg-net-hub --policy-name afwp-prod \\
    --name rcg-egress --priority 200

# App rule — allow Microsoft Update FQDNs
az network firewall policy rule-collection-group collection add-filter-collection \\
    --resource-group rg-net-hub --policy-name afwp-prod \\
    --rule-collection-group-name rcg-egress \\
    --name rc-app --collection-priority 1000 --action Allow \\
    --rule-name allow-ms-updates --rule-type ApplicationRule \\
    --target-fqdns '*.windowsupdate.com' '*.update.microsoft.com' \\
    --source-addresses 10.1.0.0/16 \\
    --protocols Http=80 Https=443

# Network rule — allow DNS to Azure DNS
az network firewall policy rule-collection-group collection add-filter-collection \\
    --resource-group rg-net-hub --policy-name afwp-prod \\
    --rule-collection-group-name rcg-egress \\
    --name rc-net --collection-priority 1100 --action Allow \\
    --rule-name allow-dns --rule-type NetworkRule \\
    --destination-addresses 168.63.129.16 --destination-ports 53 \\
    --source-addresses 10.1.0.0/16 --ip-protocols UDP

# Firewall (in the hub)
az network firewall create --name afw-prod --resource-group rg-net-hub \\
    --firewall-policy afwp-prod --vnet-name vnet-hub --sku AZFW_VNet \\
    --tier Standard --zones 1 2 3
az network firewall ip-config create --firewall-name afw-prod --name fw-ipcfg \\
    --public-ip-address pip-afw --resource-group rg-net-hub --vnet-name vnet-hub`},
        { kind: 'callout', level: 'warn', title: 'Force-tunnel spoke egress with a UDR', body: 'Deploying Azure Firewall in the hub does not automatically send spoke traffic through it. You must add a <b>User-Defined Route</b> on each spoke subnet: <code>0.0.0.0/0 → next-hop: firewall private IP</code>. Forget this and your firewall sits idle while traffic hairpins straight out to the internet.' }
      ]
    },

    {
      id: 'load-balancers',
      title: 'Load Balancers',
      icon: '⚖️',
      tagline: 'Azure Load Balancer (L4), Application Gateway (L7 + WAF), Front Door (global edge).',
      sections: [
        { kind: 'prose', html: `
          <p>Four LB options — pick the one that matches the traffic's layer and geography:</p>
          <ul>
            <li><b>Azure Load Balancer (ALB)</b> — L4, TCP/UDP, internal or public, zone-redundant. Standard tier is the default.</li>
            <li><b>Application Gateway (AppGW)</b> — L7, HTTP/HTTPS, path/host routing, WAF (optional), autoscale v2. In-region.</li>
            <li><b>Azure Front Door</b> — Global L7, Anycast, TLS termination at the edge, caching, WAF. Multi-region in front of many AppGWs or directly backend-attached.</li>
            <li><b>Traffic Manager</b> — DNS-based global director (no data-path termination). Useful for non-HTTP failover.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'Tiered ingress: Front Door → AppGW → VMs', ascii: `
   Clients globally
        │
        ▼
   ┌──── Azure Front Door ────┐   Anycast, TLS, WAF, global failover
   └──────────┬───────────────┘
              │ (private link origin)
              ▼
   ┌──── Application Gateway ─┐   in-region L7, WAF v2, path/host rules
   └──────────┬───────────────┘
              │
              ▼
         Backend pool
         (VMSS / AKS / VMs)
` },
        { kind: 'cli', title: 'Internal Standard Load Balancer for a multi-tier app', code: `az network lb create --resource-group rg-app-prod --name ilb-app \\
    --sku Standard --vnet-name vnet-prod --subnet snet-app \\
    --private-ip-address 10.1.1.100 --frontend-ip-name fip-app \\
    --backend-pool-name bep-app

az network lb probe create --resource-group rg-app-prod --lb-name ilb-app \\
    --name probe-8080 --protocol Http --port 8080 --path /healthz

az network lb rule create --resource-group rg-app-prod --lb-name ilb-app \\
    --name rule-8080 --protocol Tcp --frontend-port 8080 --backend-port 8080 \\
    --frontend-ip-name fip-app --backend-pool-name bep-app --probe-name probe-8080 \\
    --idle-timeout 15 --enable-tcp-reset true`},
        { kind: 'callout', level: 'tip', title: 'Use zone-redundant Standard — always', body: 'The free "Basic" SKUs for LB/AppGW exist but lack zone redundancy and will be retired. Default to <b>Standard SKU + zone-redundant frontends</b> everywhere, even in dev — the cost difference is negligible and it stops you accidentally shipping a single-zone design to production.' }
      ]
    },

    {
      id: 'vpn-er',
      title: 'VPN Gateway & ExpressRoute',
      icon: '🔗',
      tagline: 'Site-to-site IPsec for branches, ExpressRoute private circuits for enterprise.',
      sections: [
        { kind: 'prose', html: `
          <p>Two hybrid options, often deployed together:</p>
          <ul>
            <li><b>VPN Gateway</b> — IPsec over the internet. SKUs differ by BGP support, throughput, tunnel count (VpnGw1 → VpnGw5, plus AZ-redundant variants). Route-based preferred over policy-based.</li>
            <li><b>ExpressRoute (ER)</b> — private circuit via a provider partnership (BT, Equinix, Megaport, etc.). Predictable latency, SLA-backed, up to 100 Gbps. Two peerings: <b>private</b> (to VNets via ER Gateway) and <b>Microsoft</b> (to M365, Azure PaaS public endpoints).</li>
          </ul>
          <p>Connect both to the hub's <code>GatewaySubnet</code> and enable <b>Gateway Transit</b> on peering so spokes inherit connectivity.</p>
        `},
        { kind: 'diagram', title: 'Hybrid with ER primary + VPN failover', ascii: `
   On-prem      ──── ExpressRoute circuit ───── ER Gateway ─┐
                                                            │
                                                            ├─▶ Hub VNet ─▶ spokes
                                                            │
                ──── Internet + IPsec VPN ──── VPN Gateway ─┘
                (BGP higher local-pref on ER → VPN is backup)
` },
        { kind: 'cli', title: 'S2S VPN with BGP', code: `# GatewaySubnet must already exist in hub VNet
az network public-ip create --resource-group rg-net-hub --name pip-vpn-gw \\
    --sku Standard --allocation-method Static --zone 1 2 3

# VPN Gateway (route-based, BGP enabled, ASN 65515 default)
az network vnet-gateway create --resource-group rg-net-hub --name vpn-gw \\
    --public-ip-addresses pip-vpn-gw --vnet vnet-hub \\
    --gateway-type Vpn --vpn-type RouteBased --sku VpnGw2AZ \\
    --asn 65515 --bgp-peering-address 169.254.21.1

# Local Network Gateway (on-prem side)
az network local-gateway create --resource-group rg-net-hub --name lng-lon-dc \\
    --gateway-ip-address 203.0.113.1 --asn 65000 \\
    --bgp-peering-address 169.254.21.2 --local-address-prefixes 10.100.0.0/16

# Connection
az network vpn-connection create --resource-group rg-net-hub --name cn-lon-dc \\
    --vnet-gateway1 vpn-gw --local-gateway2 lng-lon-dc \\
    --shared-key '<strong-psk>' --enable-bgp`},
        { kind: 'callout', level: 'warn', title: 'ER Private Peering does not carry Microsoft endpoints', body: 'Private peering only reaches VNets (and services exposed inside VNets). For O365, Dynamics, Azure Storage public endpoints, etc., you need <b>Microsoft Peering</b> on the same circuit — or route those flows via Private Endpoints/Private Link inside your VNet.' }
      ]
    },

    {
      id: 'virtual-wan',
      title: 'Virtual WAN',
      icon: '🕸️',
      tagline: 'Transitive hub-and-spoke at cloud scale — Secured Hub, Routing Intent, branch integration.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Virtual WAN (vWAN)</b> is Azure's managed SD-WAN-style fabric. You create a <b>Virtual WAN</b> (global object) and deploy regional <b>Virtual Hubs</b> — each is a Microsoft-managed hub VNet with transitive routing, connectable to VPN sites, ExpressRoute circuits, Azure Firewall ("Secured Hub"), and spoke VNets.</p>
          <p>The standout feature is <b>Routing Intent and Routing Policies</b> — declare "all branch-to-internet and branch-to-branch traffic must go via the Azure Firewall in the Secured Hub" and vWAN programs the routes on every hub automatically. Replaces dozens of UDRs.</p>
        `},
        { kind: 'diagram', title: 'Virtual WAN footprint', ascii: `
                         Virtual WAN "corp-wan"
          ┌────────────────────┬───────────────────────┐
          │                    │                       │
          ▼                    ▼                       ▼
     Virtual Hub         Virtual Hub             Virtual Hub
     uksouth             westeurope              eastus
     (Secured)           (Secured)               (Secured)
       │                   │                       │
    ER + VPN            ER circuit              VPN sites
    Spokes              Spokes                  Spokes
          └────── inter-hub transitive routing ─────┘
` },
        { kind: 'cli', title: 'vWAN + Hub + a VPN site', code: `az extension add --name virtual-wan   # one time

az network vwan create --resource-group rg-net-wan --name corp-vwan \\
    --type Standard --location uksouth

az network vhub create --resource-group rg-net-wan --name vhub-uks \\
    --vwan corp-vwan --address-prefix 10.200.0.0/23 --location uksouth --sku Standard

# VPN Gateway inside the hub
az network vpn-gateway create --resource-group rg-net-wan --name vgw-uks \\
    --location uksouth --vhub vhub-uks --scale-unit 1

# VPN Site
az network vpn-site create --resource-group rg-net-wan --name site-london-dc \\
    --virtual-wan corp-vwan --location uksouth \\
    --ip-address 203.0.113.1 --address-prefixes 10.100.0.0/16 \\
    --device-vendor 'PaloAlto' --device-model 'PA-850'

# Connection between VPN Site and VPN Gateway
az network vpn-gateway connection create --gateway-name vgw-uks \\
    --resource-group rg-net-wan --name cn-london --remote-vpn-site site-london-dc \\
    --shared-key '<psk>' --connection-bandwidth 10 --enable-bgp true`},
        { kind: 'callout', level: 'tip', title: 'Routing Intent removes 90% of the UDR toil', body: 'In a Secured Hub, enable <b>Routing Intent</b> and pick "Internet traffic" and/or "Private traffic" to flow via the Azure Firewall. Microsoft programs the correct routes on every hub and connected spoke — no per-subnet UDR, no drift when you add a new VNet. Worth the Secured Hub premium alone.' }
      ]
    },

    {
      id: 'private-link',
      title: 'Private Link & Private Endpoints',
      icon: '🔒',
      tagline: 'PaaS services reachable over your VNet — not over the internet.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Private Endpoints (PE)</b> project a PaaS service (Storage, SQL, Key Vault, Cosmos, App Service…) as a NIC with a private IP inside your VNet. DNS is overridden via an Azure Private DNS zone so the service's FQDN resolves to your internal IP. This makes PaaS look and feel like a VM.</p>
          <p><b>Private Link service</b> is the flip side — expose <i>your own</i> Standard Load Balancer as a consumable Private Link service to other Azure tenants.</p>
          <p>Compare with the older <b>Service Endpoints</b>: service endpoints keep the service on its public IP but allow it via VNet, whereas Private Endpoints give you a true private IP that also works through ExpressRoute/VPN from on-prem. Default to Private Endpoints for new designs.</p>
        `},
        { kind: 'diagram', title: 'Private Endpoint flow', ascii: `
     VM in spoke VNet                  Azure PaaS (Storage Account)
           │                                       │
    corp.blob.core.windows.net                     │
           │                                       │
           │   resolves via Private DNS Zone       │
           ▼                                       │
    10.1.1.50 (private IP on PE NIC)  ───── PE ────┘
       (private link to storage account)
` },
        { kind: 'cli', title: 'Private Endpoint to a Storage Account', code: `# Assume the storage account exists. Disable public network access:
az storage account update --name stprodcorp --resource-group rg-storage \\
    --public-network-access Disabled

# Private Endpoint
az network private-endpoint create --resource-group rg-app-prod \\
    --name pe-storage --vnet-name vnet-prod --subnet snet-pe \\
    --private-connection-resource-id $(az storage account show -n stprodcorp --query id -o tsv) \\
    --group-id blob --connection-name cn-blob

# Private DNS zone and VNet link
az network private-dns zone create --resource-group rg-net-hub \\
    --name privatelink.blob.core.windows.net
az network private-dns link vnet create --resource-group rg-net-hub \\
    --zone-name privatelink.blob.core.windows.net --name pdz-prod-link \\
    --virtual-network vnet-prod --registration-enabled false

# A record: map storage account FQDN to the PE private IP
az network private-endpoint dns-zone-group create --resource-group rg-app-prod \\
    --endpoint-name pe-storage --name zgrp \\
    --private-dns-zone privatelink.blob.core.windows.net --zone-name storage-pe`},
        { kind: 'callout', level: 'warn', title: 'DNS is where Private Link most often breaks', body: 'A Private Endpoint with the wrong DNS config resolves the service to its <i>public</i> IP and the flow tries to leave your VNet. Always link the correct <code>privatelink.*</code> private DNS zone to <b>every VNet that needs resolution</b> (including on-prem via a DNS forwarder) and test with <code>nslookup</code> from a VM before you flip public access off.' }
      ]
    },

    {
      id: 'dns',
      title: 'Azure DNS & Private Resolver',
      icon: '🗺️',
      tagline: 'Public zones, private zones, Resolver inbound/outbound, conditional forwarding.',
      sections: [
        { kind: 'prose', html: `
          <p>Azure provides three DNS building blocks:</p>
          <ul>
            <li><b>Azure DNS (public)</b> — authoritative DNS for internet domains. Anycast, SLA-backed.</li>
            <li><b>Private DNS Zones</b> — private resolution attached to VNet links. Free; no listener, no forwarder.</li>
            <li><b>Azure DNS Private Resolver</b> — listener endpoints inside a VNet. Inbound (on-prem → Azure) and outbound (Azure → on-prem) with forwarding rulesets.</li>
          </ul>
          <p>For hybrid DNS you usually deploy the Private Resolver in the hub with both inbound and outbound endpoints, link every Private DNS Zone the spokes need, and point on-prem conditional forwarders at the inbound endpoint's private IP.</p>
        `},
        { kind: 'cli', title: 'Private Resolver with forwarding rules', code: `# Private Resolver
az dns-resolver create --resource-group rg-net-hub --name pdr-uks \\
    --id vnet-hub --location uksouth

# Inbound endpoint
az dns-resolver inbound-endpoint create --resource-group rg-net-hub \\
    --dns-resolver-name pdr-uks --name in-endpoint --location uksouth \\
    --ip-configurations "[{private-ip-address:'10.0.3.4',private-ip-allocation-method:Static,subnet:{id:'/subscriptions/<sub>/resourceGroups/rg-net-hub/providers/Microsoft.Network/virtualNetworks/vnet-hub/subnets/snet-pdr-in'}}]"

# Outbound endpoint + ruleset for corp.local → on-prem DC
az dns-resolver outbound-endpoint create --resource-group rg-net-hub \\
    --dns-resolver-name pdr-uks --name out-endpoint --location uksouth \\
    --subnet "/subscriptions/<sub>/resourceGroups/rg-net-hub/providers/Microsoft.Network/virtualNetworks/vnet-hub/subnets/snet-pdr-out"

az dns-resolver forwarding-ruleset create --resource-group rg-net-hub \\
    --name rs-corp --dns-resolver-outbound-endpoints '[{id:"<out-endpoint-id>"}]'

az dns-resolver forwarding-rule create --resource-group rg-net-hub \\
    --ruleset-name rs-corp --name fw-corplocal \\
    --domain-name 'corp.local.' --forwarding-rule-state Enabled \\
    --target-dns-servers '[{ip-address:"10.100.0.10",port:53},{ip-address:"10.100.0.11",port:53}]'`},
        { kind: 'callout', level: 'tip', title: 'The 168.63.129.16 shortcut', body: '<code>168.63.129.16</code> is the Azure platform DNS + wire-server. VMs query it by default. You can keep it for Azure-known FQDNs and add custom DNS servers (Private Resolver inbound) at the VNet level. Do not remove it without a replacement — some Azure agent health checks rely on it.' }
      ]
    },

    {
      id: 'identity',
      title: 'Identity & RBAC for Networking',
      icon: '🔑',
      tagline: 'Entra ID, roles, Conditional Access — who can touch the network.',
      sections: [
        { kind: 'prose', html: `
          <p>Azure auth is ID-based: everything is an Entra ID principal (user, group, service principal, managed identity). RBAC grants them access to management operations on specific scopes (MG / subscription / RG / resource).</p>
          <p>Built-in roles you will use daily:</p>
          <ul>
            <li><b>Network Contributor</b> — full access to network resources, no IAM change.</li>
            <li><b>Contributor</b> — full access but cannot assign roles.</li>
            <li><b>Reader</b> — read-only everywhere.</li>
            <li><b>User Access Administrator</b> — can assign roles but not edit resources. Split from Contributor for SoD.</li>
          </ul>
          <p>Pair RBAC with <b>Conditional Access</b> on the admin plane: require phishing-resistant MFA, managed-device compliance, and IP restriction on <code>Microsoft Azure Management</code>. That turns "stolen password" into a non-event.</p>
        `},
        { kind: 'cli', title: 'Custom role for network ops, scoped to a subscription', code: `cat > role.json <<'EOF'
{
  "Name": "NetworkOps - SG + NSG",
  "Description": "Edit NSGs, ASGs, route tables. No VNet/peering changes.",
  "Actions": [
    "Microsoft.Network/networkSecurityGroups/*",
    "Microsoft.Network/applicationSecurityGroups/*",
    "Microsoft.Network/routeTables/*",
    "Microsoft.Resources/deployments/*",
    "Microsoft.Authorization/*/read"
  ],
  "NotActions": [
    "Microsoft.Network/virtualNetworks/write",
    "Microsoft.Network/virtualNetworks/delete",
    "Microsoft.Network/virtualNetworks/peerings/*"
  ],
  "AssignableScopes": [ "/subscriptions/<sub-id>" ]
}
EOF
az role definition create --role-definition @role.json

az role assignment create --role "NetworkOps - SG + NSG" \\
    --assignee-object-id <group-object-id> --assignee-principal-type Group \\
    --scope /subscriptions/<sub-id>/resourceGroups/rg-app-prod`},
        { kind: 'callout', level: 'tip', title: 'Use managed identities for pipelines', body: 'Never hand an app a client secret. Assign a <b>system-assigned or user-assigned managed identity</b> to the pipeline agent / GitHub Runner / Azure DevOps pool, grant it exactly the roles needed, and let Azure rotate the credential. Removes 90% of leaked-secret incident tickets.' }
      ]
    },

    {
      id: 'observability',
      title: 'Observability & Network Watcher',
      icon: '🔎',
      tagline: 'NSG Flow Logs, Traffic Analytics, Connection Monitor, IP Flow Verify, Packet Capture.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Network Watcher</b> is Azure's network-diagnostics umbrella. Key tools:</p>
          <ul>
            <li><b>NSG Flow Logs</b> — per-flow records written to Storage; enrich with <b>Traffic Analytics</b> (Log Analytics) for maps and top talkers.</li>
            <li><b>Connection Monitor</b> — synthetic probes between two endpoints (VM ↔ VM, VM ↔ FQDN). Latency, loss, last-hop, continuous.</li>
            <li><b>IP Flow Verify</b> — "would this packet be allowed?" evaluates NSGs end-to-end without sending traffic.</li>
            <li><b>Next Hop</b> — returns the effective next hop for a given source IP/destination — catches UDR and routing mistakes instantly.</li>
            <li><b>Packet Capture</b> — on-demand tcpdump into a Storage blob. Great for capturing a flow you cannot reproduce elsewhere.</li>
          </ul>
        `},
        { kind: 'cli', title: 'Enable NSG Flow Logs v2 + Traffic Analytics', code: `# Storage for raw flow logs
az storage account create --resource-group rg-net-hub --name stnsgflowlogs \\
    --location uksouth --sku Standard_LRS --kind StorageV2

# Log Analytics Workspace for Traffic Analytics
az monitor log-analytics workspace create --resource-group rg-net-hub \\
    --workspace-name la-netwatch --location uksouth

# Flow Logs on a specific NSG
az network watcher flow-log create --location uksouth --name fl-nsg-prod \\
    --nsg nsg-prod --resource-group rg-net-hub \\
    --storage-account stnsgflowlogs --enabled true --format JSON --log-version 2 \\
    --retention 90 --traffic-analytics true --workspace la-netwatch \\
    --interval 10`},
        { kind: 'cli', title: 'Fast triage: IP Flow Verify and Next Hop', code: `# Would this outbound flow be allowed?
az network watcher test-ip-flow --vm vm-web01 --nic nic-web01 --direction Outbound \\
    --protocol TCP --local 10.1.1.10:12345 --remote 10.1.2.10:1433

# What does the effective route table say?
az network watcher show-next-hop --vm vm-web01 --nic nic-web01 \\
    --source-ip 10.1.1.10 --dest-ip 10.1.2.10

# Show all effective routes for a NIC
az network nic show-effective-route-table --resource-group rg-app-prod --name nic-web01 -o table`},
        { kind: 'callout', level: 'tip', title: 'Flow Logs v2 only — v1 is gone', body: 'Flow Logs v1 was retired in 2024. All new flow logs must be v2 and attached at the <b>NSG level</b> (or the newer <b>VNet Flow Logs</b> GA in 2024). If Traffic Analytics shows empty maps, the most common cause is v1 configuration lingering on automation.' }
      ]
    },

    {
      id: 'governance',
      title: 'Governance, Policy & Tags',
      icon: '📐',
      tagline: 'Azure Policy, Resource Graph, tag strategy, cost controls for networks.',
      sections: [
        { kind: 'prose', html: `
          <p>Platform controls that apply to network resources whether ops wants them or not:</p>
          <ul>
            <li><b>Azure Policy</b> — deny or audit non-compliant resources. "No NSG with 0.0.0.0/0 inbound on RDP/SSH." "Every subnet must have an NSG."</li>
            <li><b>Resource Graph</b> — KQL-over-ARM. Find every NSG rule that allows *.* from Internet in 100 subscriptions in 2 seconds.</li>
            <li><b>Tag strategy</b> — <code>CostCenter</code>, <code>Owner</code>, <code>Environment</code>, <code>DataClassification</code>. Enforced via Policy with inheritance.</li>
            <li><b>Deployment Stacks</b> — replacement for Blueprints; group deployments with deny-delete protection.</li>
          </ul>
        `},
        { kind: 'cli', title: 'Policy to deny NSG rules that expose SSH/RDP to Internet', code: `cat > policy.json <<'EOF'
{
  "mode": "All",
  "policyRule": {
    "if": {
      "allOf": [
        {"field": "type", "equals": "Microsoft.Network/networkSecurityGroups"},
        {"count": {
          "field": "Microsoft.Network/networkSecurityGroups/securityRules[*]",
          "where": {
            "allOf": [
              {"field": "Microsoft.Network/networkSecurityGroups/securityRules[*].access","equals":"Allow"},
              {"field": "Microsoft.Network/networkSecurityGroups/securityRules[*].direction","equals":"Inbound"},
              {"field": "Microsoft.Network/networkSecurityGroups/securityRules[*].sourceAddressPrefix","in":["*","0.0.0.0/0","Internet"]},
              {"anyOf": [
                {"field":"Microsoft.Network/networkSecurityGroups/securityRules[*].destinationPortRange","contains":"22"},
                {"field":"Microsoft.Network/networkSecurityGroups/securityRules[*].destinationPortRange","contains":"3389"}
              ]}
            ]
          }
        }, "greater": 0 }
      ]
    },
    "then": { "effect": "deny" }
  }
}
EOF
az policy definition create --name deny-exposed-admin-ports \\
    --mode All --rules @policy.json --display-name "Deny NSG rules exposing SSH/RDP"
az policy assignment create --name deny-exposed-admin --policy deny-exposed-admin-ports \\
    --scope /providers/Microsoft.Management/managementGroups/corp`},
        { kind: 'cli', title: 'Resource Graph — find all wide-open rules', code: `az graph query -q '
  Resources
  | where type == "microsoft.network/networksecuritygroups"
  | mv-expand rule=properties.securityRules
  | where rule.properties.access == "Allow"
      and rule.properties.direction == "Inbound"
      and rule.properties.sourceAddressPrefix in ("*","0.0.0.0/0","Internet")
  | project subscriptionId, resourceGroup, name, ruleName=tostring(rule.name),
            ports=tostring(rule.properties.destinationPortRange)'`},
        { kind: 'callout', level: 'tip', title: 'Policy in audit, then deny', body: 'Deploy new policies in <b>Audit</b> effect first. Review the non-compliance report for two weeks. Only then flip to <b>Deny</b>. Straight to deny is how you break a deployment pipeline at 5pm Friday.' }
      ]
    },

    {
      id: 'iac',
      title: 'Infrastructure as Code',
      icon: '📜',
      tagline: 'Bicep, Terraform AzureRM, ARM templates — and how to structure network repos.',
      sections: [
        { kind: 'prose', html: `
          <p>Three practical IaC options in Azure:</p>
          <ul>
            <li><b>Bicep</b> — Microsoft's native DSL, transpiles to ARM JSON. Smaller syntax than raw ARM, first-class Visual Studio Code support, day-0 coverage of new resource types.</li>
            <li><b>Terraform (AzureRM provider)</b> — multi-cloud standard, huge module ecosystem (Azure Verified Modules, Azure Landing Zones), but new resource properties lag a few weeks behind Bicep.</li>
            <li><b>ARM JSON</b> — underlying format; rarely written by hand any more.</li>
          </ul>
          <p>Structure your network IaC in layers: <code>platform/</code> (management groups, policies, diagnostics defaults) → <code>connectivity/</code> (hub VNet, Firewall, gateways, Private DNS zones) → <code>landing-zones/</code> (spoke VNets, UDRs, NSGs) → <code>applications/</code> (app-specific resources). Terraform state or Deployment Stacks per layer, locked with Azure-native RBAC.</p>
        `},
        { kind: 'cli', title: 'Bicep: hub VNet with required subnets', code: `// hub.bicep
param location string = 'uksouth'
param hubCidr string = '10.0.0.0/20'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'vnet-hub'
  location: location
  properties: {
    addressSpace: { addressPrefixes: [hubCidr] }
    subnets: [
      { name: 'AzureFirewallSubnet',  properties: { addressPrefix: '10.0.0.0/26' } }
      { name: 'GatewaySubnet',        properties: { addressPrefix: '10.0.1.0/27' } }
      { name: 'AzureBastionSubnet',   properties: { addressPrefix: '10.0.2.0/26' } }
      { name: 'RouteServerSubnet',    properties: { addressPrefix: '10.0.3.0/27' } }
    ]
  }
}

output vnetId string = vnet.id

// deploy:
// az deployment group create --resource-group rg-net-hub --template-file hub.bicep`},
        { kind: 'cli', title: 'Terraform: landing-zone spoke', code: `terraform {
  required_version = ">= 1.6"
  required_providers { azurerm = { source = "hashicorp/azurerm", version = "~> 3.100" } }
}

provider "azurerm" { features {} }

resource "azurerm_resource_group" "rg" {
  name     = "rg-app-prod"
  location = "uksouth"
}

module "spoke" {
  source  = "Azure/avm-res-network-virtualnetwork/azurerm"
  version = "~> 0.4"

  name                = "vnet-prod"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  address_space       = ["10.1.0.0/16"]

  subnets = {
    app = { address_prefixes = ["10.1.1.0/24"] }
    pe  = { address_prefixes = ["10.1.9.0/24"] private_endpoint_network_policies = "Disabled" }
  }
}

# Peer to hub (hub must exist first)
resource "azurerm_virtual_network_peering" "to_hub" {
  name                         = "prod-to-hub"
  resource_group_name          = azurerm_resource_group.rg.name
  virtual_network_name         = module.spoke.name
  remote_virtual_network_id    = "/subscriptions/<hub-sub>/resourceGroups/rg-net-hub/providers/Microsoft.Network/virtualNetworks/vnet-hub"
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  use_remote_gateways          = true
}`},
        { kind: 'callout', level: 'tip', title: 'Use Azure Verified Modules', body: `Microsoft's Azure Verified Modules (AVM) — both Bicep and Terraform — bake in best-practice defaults (diagnostics settings, RBAC scaffolding, private endpoints where relevant). Starting from AVM beats hand-rolling modules and keeps you aligned with the Cloud Adoption Framework.` }
      ]
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting Toolkit',
      icon: '🩺',
      tagline: 'The commands and diagnostics you reach for when a flow breaks.',
      sections: [
        { kind: 'prose', html: `
          <p>A triage ladder for "X cannot reach Y" in Azure:</p>
          <ol>
            <li><b>IP Flow Verify</b> — platform verdict in seconds, identifies the specific NSG rule blocking.</li>
            <li><b>Next Hop / Effective Routes</b> — is the route table sending traffic where you think?</li>
            <li><b>Connection Monitor</b> — continuous probe, measures latency + hop count.</li>
            <li><b>NSG Flow Logs + Traffic Analytics</b> — retrospective evidence.</li>
            <li><b>Packet Capture</b> — on-demand tcpdump to a Storage blob.</li>
          </ol>
        `},
        { kind: 'cli', title: 'One-minute triage', code: `# 1. Would the packet be allowed?
az network watcher test-ip-flow --vm vm-web01 --nic nic-web01 --direction Outbound \\
    --protocol TCP --local 10.1.1.10:12345 --remote 10.1.2.10:1433

# 2. Effective routes on the NIC
az network nic show-effective-route-table --resource-group rg-app-prod --name nic-web01 -o table

# 3. Effective NSG rules (combines subnet + NIC NSGs)
az network nic list-effective-nsg --resource-group rg-app-prod --name nic-web01

# 4. Connection troubleshoot (one-shot)
az network watcher test-connectivity --source-resource /subscriptions/<s>/.../vm-web01 \\
    --dest-address 10.1.2.10 --dest-port 1433 --protocol Tcp

# 5. Start a packet capture, 60s, to storage
az network watcher packet-capture create --resource-group rg-app-prod \\
    --vm vm-web01 --name pc-01 --time-limit 60 \\
    --storage-account stpcapture --storage-path 'https://stpcapture.blob.core.windows.net/captures'`},
        { kind: 'table', title: 'Common Azure networking gotchas', headers: ['Symptom','Likely cause','Check / fix'], rows: [
          ['Spoke A cannot reach Spoke B','Peering is non-transitive','UDR to firewall or use Virtual WAN'],
          ['PE resolves public IP','Private DNS zone not linked to VNet','Link <code>privatelink.*</code> zone to every VNet that needs it'],
          ['No route to on-prem','Gateway Transit disabled on peering','Enable on hub side + <code>useRemoteGateways</code> on spoke'],
          ['UDRs ignored','Default system route wins for more-specific prefix','Review effective routes, add a more specific UDR'],
          ['Firewall not seeing traffic','No UDR from spoke to firewall','Add <code>0.0.0.0/0 → firewall private IP</code> to spoke subnets'],
          ['Asymmetric return traffic','NSG on one side missing return rule — but NSG is stateful!','Usually not the NSG; check routes on the return side'],
          ['Connection Monitor red','Managed identity lacks Reader at target RG','Assign reader role to CM principal']
        ]},
        { kind: 'callout', level: 'warn', title: 'NSGs on GatewaySubnet are unsupported', body: 'Attaching an NSG to <code>GatewaySubnet</code> is unsupported and will break VPN/ER gateway connectivity in non-obvious ways. Leave it naked — rely on the gateway SKU + access rules elsewhere.' }
      ]
    },

    {
      id: 'cost',
      title: 'Cost & Data-Transfer Pitfalls',
      icon: '💰',
      tagline: 'Where the network line item on the Azure bill actually comes from.',
      sections: [
        { kind: 'prose', html: `
          <p>Azure networking has fewer surprise line items than AWS, but the big ones are real:</p>
          <ul>
            <li><b>Inter-Region bandwidth</b> — standard "zone 1 ↔ zone 2" pricing (~$0.05/GB, varies).</li>
            <li><b>Inter-AZ within a region</b> — <i>free</i> at the moment (Microsoft may change this).</li>
            <li><b>VPN Gateway data</b> — small processing cost + the SKU hourly fee.</li>
            <li><b>ExpressRoute</b> — port hours + metered / unlimited outbound data plan.</li>
            <li><b>Azure Firewall</b> — significant. Hourly fee + processed data. Every spoke routed via it adds up.</li>
            <li><b>Private Endpoints</b> — per-hour + per-GB. Stack up quickly when you wire every PaaS as PE.</li>
          </ul>
        `},
        { kind: 'table', title: 'Network cost traps and remedies', headers: ['Trap','Fix'], rows: [
          ['Many small Private Endpoints per service','Share one PE per service+VNet where possible; use Private Link Service for your own'],
          ['Under-utilised ExpressRoute port','Right-size bandwidth; review egress plan (metered vs unlimited)'],
          ['Inter-region replication on a noisy app','Either keep data in-region or use Azure-native replication (Storage GRS, Cosmos multi-region)'],
          ['Azure Firewall for all spokes, always-on','Split egress via Virtual WAN Routing Intent; off-peak deallocation is not supported — size for steady-state'],
          ['Bandwidth monitoring not granular','Enable Traffic Analytics + workbook; export to Cost Management with tags']
        ]},
        { kind: 'callout', level: 'tip', title: 'Azure Reservations apply to networking too', body: 'VPN Gateway, ExpressRoute ports, and Azure Firewall all have <b>reservation</b> pricing (1- or 3-year). For anything running 24/7 you save 30–60% by committing. Review the reservation recommendations under Cost Management → Reservations monthly — free, no risk.' }
      ]
    }
  ]
};
