#!/usr/bin/env node
/** Fifth enrichment pass — closes remaining gaps to ensure 10+ per section */
import { readFileSync, writeFileSync } from 'fs';
const PATH = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(PATH, 'utf8'));

const EXAMPLES = {
  // ── Ref 10. Storage, Mounting & Filesystems ────────────────────────────
  'mount -a': '$ mount -a\n# mounts all filesystems listed in /etc/fstab (run after editing fstab)',
  'umount dir': '$ umount /mnt/data\n# unmounts by mount point',
  'umount -f dir': '$ umount -f /mnt/nfs-share\n# force unmount; useful for stale NFS mounts',
  'df -hT': '$ df -hT\nFilesystem     Type      Size  Used Avail Use% Mounted on\n/dev/sda3      ext4       47G   22G   23G  49% /\ntmpfs          tmpfs      16G  512M   16G   4% /dev/shm\n/dev/sda2      ext4      1.9G  340M  1.4G  20% /boot',
  'mkfs.ext4 device': '$ mkfs.ext4 /dev/sdc1\nmke2fs 1.46.5\nCreating filesystem with 26214400 4k blocks\nFilesystem UUID: aabbccdd-...\nWriting inode tables: done\nCreating journal: done',
  'mkfs.xfs device': '$ mkfs.xfs /dev/sdc2\nmeta-data=/dev/sdc2  isize=512  agcount=4\ndata blocks=26214400  bsize=4096',
  'mkfs.fat device': '$ mkfs.fat -F 32 /dev/sdc1\nmkfs.fat 4.2 (2021-01-31)\n# creates FAT32 filesystem (required for EFI partitions)',
  'tune2fs -l device': '$ tune2fs -l /dev/sda3\ntune2fs 1.46.5\nFilesystem volume name: <none>\nLast mounted on: /\nFilesystem state: clean\nFree blocks: 6123456\nMount count: 12',
  'fsck -f /dev/sda1': '$ fsck -f /dev/sdb1\nfsck from util-linux 2.37.2\ne2fsck: clean, 125/6553600 files, 198344/26214400 blocks',
  'resize2fs /dev/sda1': '$ resize2fs /dev/sdb1\nresize2fs 1.46.5\nFilesystem at /dev/sdb1 is mounted on /data; on-line resizing required\nThe filesystem on /dev/sdb1 is now 13107200 (4k) blocks long.',
  'xfs_growfs /mnt': '$ xfs_growfs /data\nmeta-data=/dev/sdc2  isize=512  agcount=4, agsize=6553600 blks\ndata blocks changed from 26214400 to 52428800',

  // ── Ref 12. Text Processing ────────────────────────────────────────────
  "awk '{print $2,$3}' file": "$ awk '{print $2,$3}' /var/log/auth.log | head -3\nJun 21 09:35:01 09:35:02",
  "awk '/pattern/ {print $0}' file": "$ awk '/FAILED/' /var/log/auth.log | head -3\nJun 21 09:12:01 host sshd[1234]: Failed password for root from 10.10.10.99",
  "awk '{sum+=$1} END {print sum}' file": "$ awk '{sum+=$10} END {print \"Total bytes:\", sum}' /var/log/nginx/access.log\nTotal bytes: 54321987",
  "awk 'NR%2==0' file": "$ awk 'NR%2==0' /etc/hosts\n127.0.1.1   myhost\n::1         localhost\n# prints every second line",
  "awk '{print NF}' file": "$ awk '{print NF}' /etc/hosts | sort -u\n1\n2\n3\n# prints the number of fields per line",
  "awk '{print $NF}' file": "$ awk '{print $NF}' /etc/hosts\nlocalhost\nmyhost\n# prints last field of each line",
  "awk 'BEGIN{FS=\":\"}{print $1,$3}' /etc/passwd": "$ awk 'BEGIN{FS=\":\"}{print $1,$3}' /etc/passwd | head -5\nroot 0\ndaemon 1\nbin 2\nnobody 65534",
  "sed -n '1,50p' file": "$ sed -n '1,50p' /var/log/syslog\n# prints only lines 1 through 50",
  "sed '/^#/d' file": "$ sed '/^#/d' /etc/ssh/sshd_config | sed '/^$/d' | head -8\nPort 22\nProtocol 2\nPermitRootLogin no\nPasswordAuthentication no\n# removes comment and blank lines",
  "cut -d: -f1 /etc/passwd": "$ cut -d: -f1 /etc/passwd | head -5\nroot\ndaemon\nbin\nsys\nsync",
  "paste file1 file2": "$ paste hostnames.txt ips.txt\nrouter01  192.168.1.1\nswitch01  192.168.1.2\nserver01  192.168.1.10",
  "column -t file": "$ column -t /etc/hosts\n127.0.0.1  localhost\n127.0.1.1  myhost\n::1        localhost ip6-localhost",
  "tee file": "$ echo 'net.ipv4.ip_forward=1' | tee /etc/sysctl.d/99-forward.conf\nnet.ipv4.ip_forward=1\n# writes to file and stdout simultaneously",

  // ── Ref 15. Firewall (UFW) ─────────────────────────────────────────────
  'sudo ufw reload': '$ sudo ufw reload\nFirewall reloaded\n# re-reads rules without disrupting existing connections',
  'sudo ufw allow 443/tcp': '$ sudo ufw allow 443/tcp\nRule added\nRule added (v6)',
  'sudo ufw allow 8080/tcp': '$ sudo ufw allow 8080/tcp comment "Dev webserver"\nRule added\nRule added (v6)',
  'sudo ufw allow from 192.168.1.0/24': '$ sudo ufw allow from 192.168.1.0/24 to any port 22\nRule added',
  'sudo ufw allow 10000:20000/udp': '$ sudo ufw allow 10000:20000/udp\nRule added\nRule added (v6)\n# allows UDP ports 10000-20000 (e.g., RTP media range)',
  'sudo ufw deny 80': '$ sudo ufw deny 80\nRule added\nRule added (v6)',
  'sudo ufw deny 445/tcp': '$ sudo ufw deny 445/tcp comment "Block SMB"\nRule added\nRule added (v6)',
  'sudo ufw deny from 10.0.0.0/8': '$ sudo ufw deny from 10.0.0.0/8\nRule added\n# blocks all traffic from RFC1918 10.0.0.0/8 block',
  'sudo ufw insert 1 allow from 10.0.0.5': '$ sudo ufw insert 1 allow from 10.0.0.5\nRule inserted\n# inserts rule at position 1 (highest priority)',
  'sudo ufw app list': '$ sudo ufw app list\nAvailable applications:\n  Nginx Full\n  Nginx HTTP\n  Nginx HTTPS\n  OpenSSH',
  'sudo ufw limit ssh': '$ sudo ufw limit ssh\nRule added\nRule added (v6)\n# rate-limits SSH: blocks after 6 connections in 30s from same IP',

  // ── Ref 17. Advanced Networking ───────────────────────────────────────
  'ip route add default via 192.168.1.1': '$ ip route add default via 192.168.1.1 dev eth0\n$ ip route show default\ndefault via 192.168.1.1 dev eth0 proto static metric 100',
  'ip route del 10.0.0.0/24': '$ ip route del 10.0.0.0/24\n# removes the static route to 10.0.0.0/24',
  'ip rule show': '$ ip rule show\n0:      from all lookup local\n32766:  from all lookup main\n32767:  from all lookup default',
  'ip rule add from 192.168.1.0/24 table 100': '$ ip rule add from 192.168.1.0/24 table 100\n$ ip rule show\n0:      from all lookup local\n32765:  from 192.168.1.0/24 lookup 100\n32766:  from all lookup main',
  'nmcli radio wifi off': '$ nmcli radio wifi off\n# disables WiFi radio',
  'ethtool -K eth0 gro off': '$ ethtool -K eth0 gro off\nActual changes:\ngro: off\n# disables Generic Receive Offload (useful for packet capture accuracy)',
  'ethtool -G eth0 rx 4096 tx 4096': '$ ethtool -G eth0 rx 4096 tx 4096\n# sets NIC ring buffer sizes to 4096 (improves throughput under load)',
  'tc netem add delay 100ms': '$ tc qdisc add dev eth0 root netem delay 100ms\n# adds 100ms latency to eth0 (WAN simulation)',
  'tc qdisc del dev eth0 root': '$ tc qdisc del dev eth0 root\n# removes all traffic control rules from eth0',
  'ip netns add ns1': '$ ip netns add ns1\n$ ip netns exec ns1 ip link set lo up\n$ ip netns list\nns1',

  // ── Ref 20. Backup & Snapshots ────────────────────────────────────────
  'dd if=/dev/sda of=disk.img bs=4M': '$ dd if=/dev/sda of=/backup/sda.img bs=4M status=progress\n5242880000 bytes (5.2 GB, 4.9 GiB) copied, 120.3 s, 43.6 MB/s\n# raw disk image; requires device unmounted or read-only',
  'dd if=/dev/zero of=/swapfile bs=1M count=2048': '$ dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress\n2147483648 bytes (2.1 GB) copied, 4.5 s, 477 MB/s\n$ chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
  'tar -czf $(date +%F).tar.gz dir': '$ tar -czf $(date +%F)-backup.tar.gz /var/www\n$ ls\n2026-06-21-backup.tar.gz',
  'cpio -o < filelist > archive.cpio': '$ find /etc -type f | cpio -ov > /backup/etc-$(date +%F).cpio\n/etc/hosts\n/etc/fstab\n/etc/sshd/sshd_config\n1234 blocks',
  'ddrescue /dev/sda image logfile': '$ ddrescue -d /dev/sda /backup/sda.img /backup/sda.log\nGNU ddrescue 1.25\nrescued: 499.8 GB, error size: 0 B, current rate: 120 MB/s\n# ddrescue recovers failing drives; continues around bad sectors',
  'btrfs subvolume snapshot /data /snap/data': '$ btrfs subvolume snapshot /data /snap/data-2026-06-21\nCreate a snapshot of \'/data\' in \'/snap/data-2026-06-21\'',
  'restic backup /home': '$ restic -r /backup/restic backup /home\nrepository a1b2c3d4 opened\nFiles:           1234 new,  456 changed, 23456 unmodified\nAdded to the repo: 123.456 MiB\nsnapshot a1b2c3d5 saved',
  'rsnapshot daily': '$ rsnapshot daily\n# runs a daily rsnapshot backup rotation cycle\n$ ls /backup/\ndaily.0/  daily.1/  daily.2/  weekly.0/',

  // ── Ref 21. SSH Hardening & Key Management ────────────────────────────
  'ssh-keygen -y -f keyfile': '$ ssh-keygen -y -f ~/.ssh/id_ed25519\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAbc... user@host\n# derives public key from private key file',
  'ssh-keygen -R host': '$ ssh-keygen -R 192.168.1.5\n# Host 192.168.1.5 found: line 14\n/home/user/.ssh/known_hosts updated.\n# use after OS reinstall to remove stale host key',
  'ssh-keyscan host': '$ ssh-keyscan -H 192.168.1.5 >> ~/.ssh/known_hosts\n# 192.168.1.5:22 SSH-2.0-OpenSSH_8.9p1\n# adds host key to known_hosts without manual verification prompt',
  'scp -P 2222 file user@host:/path': '$ scp -P 2222 report.tar.gz admin@192.168.1.5:/backup/\nreport.tar.gz         100%   45MB   5.2MB/s   00:08',
  'ssh -L 8080:localhost:80 user@host': '$ ssh -L 8080:internal-web:80 -N -f admin@bastion.corp.com\n# forwards localhost:8080 → internal-web:80 via bastion; runs in background',
  'ssh -o StrictHostKeyChecking=no user@host': '$ ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null admin@10.0.0.5\nWarning: Permanently added \'10.0.0.5\' (ED25519) to the list of known hosts.\n# bypasses host key checking; use ONLY in automation/testing',
  'ssh -o ConnectTimeout=5 user@host': '$ ssh -o ConnectTimeout=5 admin@10.0.0.100\nssh: connect to host 10.0.0.100 port 22: Connection timed out\n# fails fast after 5s instead of waiting OS default (~75s)',
  'ssh -o ServerAliveInterval=30 user@host': '$ ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 admin@remote-host\n# sends keepalive every 30s; disconnects after 3 missed responses',
  'ssh -fNT -D 1080 user@host': '$ ssh -fNT -D 1080 admin@jump-host\n# SOCKS5 proxy on localhost:1080; runs in background (-f -N)',
  'sshd -t': '$ sshd -t\n# tests sshd_config syntax; no output = no errors',

  // ── Ref 22. Kernel & Module Management ───────────────────────────────
  'cat /proc/cpuinfo': '$ cat /proc/cpuinfo | grep -E "model name|cpu MHz|cpu cores" | head -6\nmodel name   : Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz\ncpu MHz      : 2100.000\ncpu cores    : 16',
  'cat /proc/meminfo': '$ cat /proc/meminfo | head -8\nMemTotal:       32768000 kB\nMemFree:        15204096 kB\nMemAvailable:   19922944 kB\nBuffers:           217088 kB\nCached:           4649984 kB',
  'cat /proc/uptime': '$ cat /proc/uptime\n432001.23 3412012.34\n# first: uptime seconds; second: idle CPU seconds (sum of all cores)',
  'cat /proc/loadavg': '$ cat /proc/loadavg\n0.45 0.52 0.38 1/654 12345\n# 1m avg, 5m avg, 15m avg, running/total threads, last PID',
  'cat /proc/version': '$ cat /proc/version\nLinux version 5.15.0-91-generic (buildd@lcy02-amd64-060) (gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0, GNU ld (GNU Binutils for Ubuntu) 2.38) #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023',
  'sysctl -w key=value': '$ sysctl -w net.ipv4.ip_forward=1\nnet.ipv4.ip_forward = 1\n# temporary; add to /etc/sysctl.d/ to make permanent',
  'sysctl net.ipv4.ip_forward': '$ sysctl net.ipv4.ip_forward\nnet.ipv4.ip_forward = 1',
  'sysctl vm.swappiness': '$ sysctl vm.swappiness\nvm.swappiness = 10\n# lower value = less aggressive swapping; 0-100',
  'sysctl -p': '$ sysctl -p /etc/sysctl.d/99-custom.conf\nnet.ipv4.ip_forward = 1\nnet.core.somaxconn = 65535\n# applies sysctl settings from file',
  'uname -r': '$ uname -r\n5.15.0-91-generic',

  // ── Ref 23. Docker & Containers ───────────────────────────────────────
  'docker stats': '$ docker stats --no-stream\nCONTAINER ID   NAME        CPU %   MEM USAGE/LIMIT   MEM %   NET I/O\na1b2c3d4e5f6   web-nginx   0.12%   45.2MiB/31.6GiB   0.14%   1.3MB/4.7MB\nb6c5d4e3f2a1   postgres    2.34%   512MiB/31.6GiB    1.58%   0B/0B',
  'docker system prune -a': '$ docker system prune -a\nWARNING! This will remove all images, containers, networks not used.\nAre you sure you want to continue? [y/N] y\nDeleted Containers: a1b2c3d4...\nDeleted Images: sha256:abc...\nTotal reclaimed space: 4.23GB',
  'docker network ls': '$ docker network ls\nNETWORK ID     NAME        DRIVER    SCOPE\nabc123def456   bridge      bridge    local\ndef456abc789   host        host      local\n789abc123def   myapp-net   bridge    local',
  'docker network inspect network': '$ docker network inspect myapp-net\n[{"Name":"myapp-net","Driver":"bridge","IPAM":{"Config":[{"Subnet":"172.20.0.0/16","Gateway":"172.20.0.1"}]},"Containers":{"a1b2...":{"Name":"web-nginx","IPv4Address":"172.20.0.2/16"}}}]',
  'docker volume ls': '$ docker volume ls\nDRIVER    VOLUME NAME\nlocal     postgres-data\nlocal     nginx-certs\nlocal     app-uploads',
  'docker volume inspect volume': '$ docker volume inspect postgres-data\n[{"Name":"postgres-data","Driver":"local","Mountpoint":"/var/lib/docker/volumes/postgres-data/_data","CreatedAt":"2026-06-01T08:00:00Z"}]',
  'docker build -t image .': '$ docker build -t myapp:latest .\n[+] Building 15.3s (10/10) FINISHED\n => [1/5] FROM docker.io/library/python:3.11    5.2s\n => [2/5] WORKDIR /app                         0.1s\n => [3/5] COPY requirements.txt .              0.1s\n => [4/5] RUN pip install -r requirements.txt  9.5s\n => [5/5] COPY . .                             0.1s',
  'docker tag image repo/image': '$ docker tag myapp:latest registry.corp.com/team/myapp:1.0.0\n$ docker images | grep myapp\nmyapp                             latest    a1b2c3d4e5f6   1 hour ago   512MB\nregistry.corp.com/team/myapp      1.0.0     a1b2c3d4e5f6   1 hour ago   512MB',
  'docker push repo/image': '$ docker push registry.corp.com/team/myapp:1.0.0\nThe push refers to repository [registry.corp.com/team/myapp]\n1.0.0: digest: sha256:abc123... size: 2345',
  'docker-compose up -d': '$ docker-compose up -d\nCreating network "app_default" with the default driver\nCreating app_postgres_1 ... done\nCreating app_web_1      ... done\nCreating app_nginx_1    ... done',
  'docker-compose down': '$ docker-compose down\nStopping app_nginx_1    ... done\nStopping app_web_1      ... done\nStopping app_postgres_1 ... done\nRemoving network app_default',
  'docker exec container cat /etc/hosts': '$ docker exec web-nginx cat /etc/hosts\n127.0.0.1       localhost\n172.17.0.2      a1b2c3d4e5f6  web-nginx',
  'docker cp container:/path .': '$ docker cp web-nginx:/etc/nginx/nginx.conf ./nginx.conf\n# copies file from container to local filesystem',

  // ── Ref 25. Cryptography & Hashing ────────────────────────────────────
  'openssl rand -base64 48': '$ openssl rand -base64 48\nMj8kNpL2xRvQs9wYz4hBcA7eT1mF6uW3dX0nV5oP==\n# 48 random bytes encoded as base64 (good for tokens/secrets)',
  'openssl x509 -in cert.pem -text -noout': '$ openssl x509 -in server.pem -text -noout\nCertificate:\n    Data:\n        Version: 3 (0x2)\n        Serial Number: 1234567890\n        Validity\n            Not Before: Jan  1 00:00:00 2026 GMT\n            Not After : Jan  1 00:00:00 2028 GMT\n        Subject: CN=server.corp.com, O=Corp, C=US\n        Subject Alternative Name: DNS:server.corp.com, DNS:*.corp.com',
  'openssl req -new -key key.pem -out csr.pem': '$ openssl req -new -key server.key -out server.csr -subj "/CN=server.corp.com/O=Corp/C=US"\n# generates a Certificate Signing Request',
  'openssl verify cert.pem': '$ openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt server.pem\nserver.pem: OK',
  'openssl enc -aes-256-cbc -salt -in file -out file.enc': '$ openssl enc -aes-256-cbc -salt -pbkdf2 -in secret.txt -out secret.txt.enc\nenter aes-256-cbc encryption password:\nVerifying - enter aes-256-cbc encryption password:',
  'openssl rsa -in key -check': '$ openssl rsa -in server.key -check\nRSA key ok\n# verifies RSA private key integrity',
  'openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem': '$ openssl pkcs12 -export -out server.p12 -inkey server.key -in server.pem -certfile ca-chain.pem\nEnter Export Password:\nVerifying - Enter Export Password:\n# bundles cert + key into PKCS#12 for import into browsers/Java',
  'pwgen 20 1': '$ pwgen -s 20 1\nK7mN2pL9xRvQs4wYz8hB\n# generates a secure 20-character random password',
  'age -encrypt -r key file': '$ age -encrypt -r age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx backup.tar.gz > backup.tar.gz.age\n# encrypts file using age public key',
  'openssl s_client -connect host:443': '$ openssl s_client -connect example.com:443 </dev/null 2>/dev/null | openssl x509 -noout -dates\nnotBefore=Jan  1 00:00:00 2026 GMT\nnotAfter =Jan  1 00:00:00 2028 GMT',

  // ── Ref 28. Virtualization ────────────────────────────────────────────
  'virsh domstats vm': '$ virsh domstats ubuntu22\nDomain: ubuntu22\n  state.state=1\n  cpu.time=789000000000\n  balloon.current=4194304\n  vcpu.current=4\n  net.count=1\n  net.0.rx.bytes=1234567\n  block.count=1\n  block.0.rd.reqs=5678',
  'virsh snapshot-create vm': '$ virsh snapshot-create ubuntu22\nDomain snapshot 1719000000 created',
  'virsh snapshot-list vm': '$ virsh snapshot-list ubuntu22\n Name                  Creation Time             State\n--------------------------------------------------------\n snap-2026-06-21        2026-06-21 09:30:00 +0000  running\n pre-update             2026-06-20 14:00:00 +0000  shutoff',
  'virsh snapshot-revert vm snap': '$ virsh snapshot-revert ubuntu22 pre-update\n# reverts VM to pre-update snapshot state',
  'virt-install --name vm --ram 2048': '$ virt-install --name centos9 --ram 2048 --vcpus 2 --disk size=20 --cdrom /iso/CentOS-9-x86_64.iso --os-variant centos-stream9\nStarting installation...\nAllocating \'centos9.qcow2\' | 20 GB | 00:00:08',
  'virt-clone --original vm1 --name vm2': '$ virt-clone --original ubuntu22 --name ubuntu22-test --auto-clone\nAllocating \'ubuntu22-test.qcow2\'  |  50 GB  00:02:15\nClone \'ubuntu22-test\' created successfully.',
  'virsh net-list': '$ virsh net-list\n Name      State    Autostart   Persistent\n-------------------------------------------\n default   active   yes         yes\n isolated  active   yes         yes',
  'virsh pool-list': '$ virsh pool-list\n Name      State    Autostart\n----------------------------\n default   active   yes\n nvme      active   yes',

  // ── Ref 29. System Benchmarking & Diagnostics ─────────────────────────
  'stress-ng --cpu 8 --io 4': '$ stress-ng --cpu 8 --io 4 --timeout 30\nstress-ng: info: [12345] dispatching hogs: 8 cpu, 4 io\nstress-ng: info: [12345] successful run completed in 30.00s',
  'memtester 1G 1': '$ memtester 1G 1\nmemtester version 4.5.1 (64-bit)\nCopying... ok\nComparing... ok\nInitializing memory...\nLoop 1/1:\n  Stuck Address       : ok\n  Random Value        : ok\n  Compare XOR         : ok\n  Compare SUB         : ok',
  'lscpu': '$ lscpu\nArchitecture:          x86_64\nCPU(s):                32\nThread(s) per core:    2\nCore(s) per socket:    8\nSocket(s):             2\nModel name:            Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz\nL1d cache:             512 KiB\nL3 cache:              35.75 MiB',
  'lscpu -e': '$ lscpu -e\nCPU NODE SOCKET CORE L1d:L1i:L2:L3 ONLINE MAXMHZ   MINMHZ\n  0    0      0    0 0:0:0:0       yes    4000.00  800.00\n  1    0      0    1 1:1:1:0       yes    4000.00  800.00',
  'lspci -k': '$ lspci -k | head -15\n00:00.0 Host bridge: Intel Corporation C610 Chipset\n00:19.0 Ethernet controller: Intel Corporation I350 Gigabit\n        Kernel driver in use: igb\n        Kernel modules: igb\n01:00.0 Ethernet controller: Intel Corporation X550 10GbE\n        Kernel driver in use: ixgbe',
  'dmidecode -t processor': '$ dmidecode -t processor | grep -E "Socket|Version|Max Speed|Core Count"\n\tSocket Designation: CPU1\n\tVersion: Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz\n\tMax Speed: 4000 MHz\n\tCore Count: 16',
  'sensors': '$ sensors\ncoretemp-isa-0000\nCore 0:        +42.0°C  (high = +100.0°C, crit = +100.0°C)\nCore 1:        +44.0°C\nCore 2:        +41.0°C\n\nacpitz-virtual-0\ntemp1:         +30.0°C  (crit = +119.0°C)',
  'perf stat ls': '$ perf stat ls /etc 2>&1 | tail -10\n Performance counter stats for \'ls /etc\':\n       3,456,789  cycles\n       2,345,678  instructions  #    0.68  insn per cycle\n         123,456  cache-misses  #   34.56 % of all cache refs\n         0.002345456 seconds time elapsed',
  'perf top': '$ perf top\nSamples: 12K of event \'cycles\', 4000 Hz, lost 0\n\n    12.34%  nginx      [.] ngx_http_process_request\n     8.56%  [kernel]   [k] __x86_indirect_thunk_rax\n     5.23%  nginx      [.] ngx_event_multiplex',

  // ── Ref 30. Bash Scripting Essentials ────────────────────────────────
  "IFS=$'\\n\\t'": "#!/usr/bin/env bash\nIFS=\$'\\n\\t'\n# sets IFS to newline+tab (prevents word-splitting on spaces)\n# safer than default IFS=' \\t\\n' when processing filenames",
  'echo "text"': '#!/usr/bin/env bash\necho "Deployment complete"\necho "Server: $HOSTNAME"\necho "Time: $(date)"\n# echo to stdout; use printf for reliable formatting',
  'printf "%s\\n" "$var"': '#!/usr/bin/env bash\nname="Alice"\nprintf "Hello, %s!\\n" "$name"\n# printf is more reliable than echo for special chars',
  'read -r var': '#!/usr/bin/env bash\nread -r filename\necho "Processing: $filename"\n# -r: raw mode; prevents backslash interpretation',
  'read -p "Enter: " var': '#!/usr/bin/env bash\nread -rp "Enter hostname: " host\npng -c 1 "$host"',
  'exit 0': '#!/usr/bin/env bash\nif check_service nginx; then\n    exit 0  # success\nelse\n    exit 1  # failure\nfi',
  'exit 1': '#!/usr/bin/env bash\nif [[ ! -f "$CONFIG" ]]; then\n    echo "ERROR: config file not found: $CONFIG" >&2\n    exit 1\nfi',
  'case "$var" in pattern) ;; esac': '#!/usr/bin/env bash\ncase "$ENVIRONMENT" in\n    prod)  echo "Production" ;;\n    stage) echo "Staging"    ;;\n    dev)   echo "Dev"        ;;\n    *)     echo "Unknown: $ENVIRONMENT"; exit 1 ;;\nesac',
  'declare -A map': '#!/usr/bin/env bash\ndeclare -A servers\nservers[web]="192.168.1.10"\nservers[db]="192.168.1.20"\nfor role in "${!servers[@]}"; do\n    echo "$role → ${servers[$role]}"\ndone',
  'getopts ": h v" opt': '#!/usr/bin/env bash\nwhile getopts ":hv" opt; do\n  case $opt in\n    h) echo "Usage: $0 [-h] [-v]"; exit 0 ;;\n    v) VERBOSE=1 ;;\n    ?) echo "Unknown option: -$OPTARG" >&2; exit 1 ;;\n  esac\ndone',

  // ── Linux legacy sections – remaining ─────────────────────────────────
  'git tag -a v1.0 -m "msg"': '$ git tag -a v2.0.0 -m "Release 2.0.0 - major rewrite"\n$ git push origin v2.0.0\n# creates annotated tag (preferred over lightweight tags for releases)',
  'git show v1.0': '$ git show v1.0.0\ntag v1.0.0\nTagger: Alice Smith <alice@corp.com>\n\nRelease 1.0.0\n\ncommit a1b2c3d4...',
  'git push origin tag': '$ git push origin --tags\nTotal 3 (delta 0), reused 0 (delta 0)\nTo github.com:org/repo.git\n * [new tag]         v1.0.0 -> v1.0.0\n * [new tag]         v1.1.0 -> v1.1.0',
  'docker volume create': '$ docker volume create postgres-data\npostgres-data\n$ docker volume ls | grep postgres\nlocal     postgres-data',
  'getenforce': '$ getenforce\nEnforcing\n# Permissive = logs but not blocks; Disabled = SELinux off',
  'setenforce 0': '$ setenforce 0\n$ getenforce\nPermissive\n# temporary; resets to config value on reboot',
  'sestatus -v': '$ sestatus -v\nSELinux status:       enabled\nCurrent mode:         enforcing\nPolicy from config:   targeted\nMounted filesystems with contexts:\n    /:     system_u:object_r:root_t:s0',
  'audit2why < /var/log/audit/audit.log': '$ ausearch -ts recent -m avc | audit2why\ntype=AVC msg=audit(1719000000.123:456): avc: denied { read } for pid=1234\nWas caused by: Missing type enforcement (TE) allow rule.\nYou can use audit2allow to generate a loadable module to allow this access.',
  'ausearch -m avc -ts recent': '$ ausearch -m avc -ts recent | head -5\ntime->Sat Jun 21 09:35:00 2026\ntype=AVC msg=audit(1719000000.123:456): avc: denied { read } for pid=1234 comm="nginx"',
  'chcon -t httpd_sys_content_t file': '$ chcon -t httpd_sys_content_t -R /var/www/html\n$ ls -Z /var/www/html/index.html\nunconfined_u:object_r:httpd_sys_content_t:s0 /var/www/html/index.html',
  'restorecon -R /path': '$ restorecon -Rv /var/www/html\nRelabeled /var/www/html from httpd_user_content_t to httpd_sys_content_t',
  'pip list': '$ pip list\nPackage         Version\n------------   --------\nrequests        2.31.0\nflask           3.0.0\ngunicorn        21.2.0\nPillow          10.1.0',
  'pip freeze > requirements.txt': '$ pip freeze > requirements.txt\n$ cat requirements.txt\nflask==3.0.0\ngunicorn==21.2.0\nrequests==2.31.0',
  'python3 -c "code"': '$ python3 -c "import json,sys; data=json.load(sys.stdin); print(data[\'version\'])" < version.json\n1.4.2',
  'SHOW TABLES;': 'mysql> SHOW TABLES;\n+--------------------+\n| Tables_in_myapp    |\n+--------------------+\n| users              |\n| sessions           |\n| audit_log          |\n+--------------------+\n3 rows in set (0.00 sec)',
  'mysqladmin processlist': '$ mysqladmin -u root -p processlist\nId  User  Host                 db      Command  Time  State   Info\n1   root  localhost            myapp   Query    0     init    SHOW PROCESSLIST',
  'timedatectl set-timezone': '$ timedatectl set-timezone Europe/London\n$ timedatectl\n               Local time: Sat 2026-06-21 09:35:00 BST\n         Universal time: Sat 2026-06-21 08:35:00 UTC\n                Time zone: Europe/London (BST, +0100)',
  'timedatectl list-timezones': '$ timedatectl list-timezones | grep Europe\nEurope/Amsterdam\nEurope/London\nEurope/Paris\nEurope/Zurich',
  'timedatectl set-ntp true': '$ timedatectl set-ntp true\n$ timedatectl\nNTP service: active\nSystem clock synchronized: yes',
  'timedatectl set-time': '$ timedatectl set-time "2026-06-21 09:35:00"\n# sets system time manually (requires NTP disabled)',
  'at now + 10 minutes': '$ echo "systemctl restart nginx" | at now + 10 minutes\njob 3 at Sat Jun 21 09:45:00 2026',
  'atrm 3': '$ atrm 3\n# cancels pending at job 3\n$ atq\n# (empty — job removed)',
  'hwinfo --memory': '$ hwinfo --memory\nMemory Device 0:\n  Model: "Samsung M393A2K40DB3"\n  Size: 16384 MB\n  Type: DDR4\n  Speed: 3200 MHz\n  Slot: "CPU1_DIMM_A1"',
  'snap list': '$ snap list\nName    Version  Rev   Tracking   Publisher  Notes\ncore20  20230801 2015  latest/stable  canonical  base\nlxd     5.19/...  2630  5.19/stable  canonical  -',
  'flatpak list': '$ flatpak list\nApplication            Application ID                 Version  Branch\nGIMP                   org.gimp.GIMP                  2.10.36  stable\nVLC media player       org.videolan.VLC               3.0.20   stable',
  'ulimit -n': '$ ulimit -n\n1048576\n# maximum number of open file descriptors',
  'ulimit -n 65536': '$ ulimit -n 65536\n$ ulimit -n\n65536\n# sets open file limit for current session',
  'env': '$ env | grep -E "^(HOME|PATH|USER|SHELL|TERM)"\nHOME=/home/user\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\nUSER=user\nSHELL=/bin/bash\nTERM=xterm-256color',
  '#!/bin/bash': '#!/bin/bash\n# Note: use #!/usr/bin/env bash for portability\n# /bin/bash is common but not universal across distros',
  'set -e': '#!/usr/bin/env bash\nset -e\n# exit immediately if any command returns non-zero\n# e.g. a failed cp command stops the entire script',
  'set -euo pipefail': '#!/usr/bin/env bash\nset -euo pipefail\n# -e: exit on error; -u: error on unset vars; -o pipefail: error if pipe fails\n# Standard safe header for production scripts',
  'source script.sh': '$ source /etc/profile.d/custom.sh\n# or: . /etc/profile.d/custom.sh\n# runs script in current shell; env vars persist after',
  'declare -r VAR': '#!/usr/bin/env bash\ndeclare -r APP_ROOT="/opt/myapp"\ndeclare -r MAX_RETRIES=5\n# declare -r makes variable read-only; assignment fails silently unless set -e',
  'swapon -s': '$ swapon -s\nFilename    Type       Size    Used  Priority\n/swapfile   file       2097148    0      -2',
  'swapoff -a': '$ swapoff -a\n# disables all active swap spaces\n$ free -h | grep Swap\nSwap:          0B        0B       0B',
  'swapon -a': '$ swapon -a\n# enables all swap entries in /etc/fstab\n$ swapon -s\nFilename    Type      Size    Used  Priority\n/swapfile   file    2097148     0       -2',
  'mkswap /swapfile': '$ mkswap /swapfile\nSetting up swapspace version 1, size = 2 GiB (2147479552 bytes)\nno label, UUID=a1b2c3d4-...',
  'fsck -n /dev/sda1': '$ fsck -n /dev/sda3\ne2fsck 1.46.5 (30-Dec-2021)\n/dev/sda3: clean, 350234/3072000 files, 2143291/12288000 blocks\n# -n: dry run; checks only, makes no changes',
  'tshark -r file.pcap -Y filter': '$ tshark -r capture.pcap -Y "http.response.code >= 400"\n  45 1.234 192.168.1.5 → 10.0.0.1 HTTP/1.1 404 Not Found\n  89 2.567 192.168.1.5 → 10.0.0.1 HTTP/1.1 500 Internal Server Error',
  'tshark -T fields': '$ tshark -r capture.pcap -T fields -e ip.src -e http.request.uri -Y "http.request" | head -5\n192.168.1.5  /api/health\n10.0.0.1     /login\n192.168.1.5  /api/users',
  'tshark -z io,stat,1': '$ tshark -z io,stat,1 -r capture.pcap\n=================================\n| IO Statistics               |\n|                             |\n| Interval | Frames |  Bytes  |\n|-----------------------------|  \n|   0 <> 1 |   1234 | 567890  |',
  'tshark -z conv,tcp': '$ tshark -z conv,tcp -r capture.pcap -q\n================================================================================\nTCP Conversations\n                                               | Frames | Bytes |\n192.168.1.5:54321   <-> 10.0.0.1:443            1234     567890',
  'traceroute6 -n host': '$ traceroute6 -n 2001:4860:4860::8888\ntraceroute6 to 2001:4860:4860::8888, 30 hops max\n 1  fe80::1  0.891 ms\n 2  2001:db8::1  5.234 ms\n 3  2001:4860:4860::8888  12.456 ms',
  'traceroute6 -I host': '$ traceroute6 -I 2001:4860:4860::8888\n# uses ICMPv6 echo instead of UDP probes',
  'host -t MX domain': '$ host -t MX corp.com\ncorp.com mail is handled by 10 smtp.corp.com.\ncorp.com mail is handled by 20 smtp2.corp.com.',
  'host -t AAAA domain': '$ host -t AAAA example.com\nexample.com has IPv6 address 2606:2800:220:1:248:1893:25c8:1946',
  'wg set wg0 peer <key> endpoint': '$ wg set wg0 peer PEER_PUBLIC_KEY allowed-ips 10.8.0.2/32 endpoint 203.0.113.5:51820\n# adds a new peer to WireGuard interface wg0',
  'wg-quick up wg0': '$ wg-quick up wg0\n[#] ip link add wg0 type wireguard\n[#] wg setconf wg0 /dev/fd/63\n[#] ip -4 address add 10.8.0.1/24 dev wg0\n[#] ip link set mtu 1420 up dev wg0',
  'wg-quick down wg0': '$ wg-quick down wg0\n[#] ip link delete dev wg0',
  'lxc exec container -- command': '$ lxc exec webserver -- nginx -t\nnginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful',
  'lxc file push local container/path': '$ lxc file push nginx.conf webserver/etc/nginx/nginx.conf\n# copies local file into container',
  'lxc file pull container/path local': '$ lxc file pull webserver/var/log/nginx/access.log ./\n# copies file out of container to local filesystem',
  'lxc config show container': '$ lxc config show webserver\narchitecture: x86_64\nconfig:\n  image.architecture: amd64\n  image.description: Ubuntu 22.04 LTS\n  limits.cpu: "2"\n  limits.memory: 2GB',
  'lxc network list': '$ lxc network list\n+---------+----------+---------+-------------+---------+\n| NAME    |   TYPE   | MANAGED |     IPV4    | USED BY |\n+---------+----------+---------+-------------+---------+\n| lxdbr0  | bridge   | YES     | 10.244.75.1 |       4 |\n+---------+----------+---------+-------------+---------+',
  'lxc image list': '$ lxc image list\n+--------------------+---------+----------+\n| ALIAS              | FINGERPRINT | SIZE |\n+--------------------+---------+----------+\n| ubuntu/22.04       | a1b2c3d4    | 375MB|',
  'lxc delete container': '$ lxc delete webserver\n# deletes stopped container; use --force to delete running',
  'strace -e trace=network cmd': '$ strace -e trace=network curl https://example.com 2>&1 | head -10\nsocket(AF_INET, SOCK_STREAM, IPPROTO_TCP) = 3\nconnect(3, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("93.184.216.34")}, 16) = -1 EINPROGRESS\npoll([{fd=3, events=POLLOUT}], 1, 300000) = 1',
  'strace -e trace=file cmd': '$ strace -e trace=file ls /etc 2>&1 | head -5\nopenat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3\nopenat(AT_FDCWD, "/etc", O_RDONLY|O_DIRECTORY|O_CLOEXEC) = 4\nfstat(4, {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0',
  'strace -e trace=open cmd': '$ strace -e trace=open,openat nginx -t 2>&1 | head -8\nopenat(AT_FDCWD, "/etc/nginx/nginx.conf", O_RDONLY) = 4\nopenat(AT_FDCWD, "/etc/nginx/conf.d/default.conf", O_RDONLY) = 5',
  'strace -T cmd': '$ strace -T ls /tmp 2>&1 | tail -5\nread(3, "", 4096)     = 0 <0.000012>\nclose(3)              = 0 <0.000008>\ngetdents64(4, ...)    = 48 <0.000021>\nwrite(1, "file1\\n", 6) = 6 <0.000015>\n# -T shows time spent in each syscall',
  'strace -f cmd': '$ strace -f -o /tmp/strace.log nginx\n# follows forks; traces all child processes (-f)',
  'strace -s 1024 cmd': '$ strace -s 1024 -e trace=write curl http://example.com 2>&1 | grep "write(" | head -3\nwrite(6, "GET / HTTP/1.1\\r\\nHost: example.com\\r\\n", 38) = 38',
  'strace -c cmd': '$ strace -c ls /etc 2>&1\n% time     seconds  usecs/call  calls  errors  syscall\n------ ----------- ----------- ------  ------  ----------------\n 40.00    0.000120           4     30       0  openat\n 30.00    0.000090           9     10       0  getdents64',
  'strace -p pid -k': '$ strace -p 1234 -k 2>&1 | head -5\nstrace: Process 1234 attached\npoll([{fd=5, events=POLLIN}], 1, -1)\n > /usr/lib/x86_64-linux-gnu/libc.so.6(__poll+0x14)\n > /usr/sbin/nginx(ngx_select_process_events+0x95)',
  'System': '$ uname -a\nLinux router01 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux\n# shows all system info: kernel, hostname, arch',
  'Networking': '$ ip addr show eth0\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0',
  'Diagnostics': '$ ping -c 4 8.8.8.8\nPING 8.8.8.8: 56 data bytes\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=12.3 ms\n4 packets transmitted, 4 received, 0% packet loss',

  // ── SDX remaining advanced sections ──────────────────────────────────
  'show vpx provisioning': '> show vpx provisioning\nVPX Provisioning:\n  Profile: medium (2 CPU, 4096MB, 50GB)\n  Available profiles: small, medium, large, custom\n  Images available: NSVPX-KVM-13.1-42.47 (active)',
  'show vpx lifecycle': '> show vpx lifecycle\nVPX Lifecycle Events (last 10):\n  VPX-1  started    2026-06-16 07:05:00\n  VPX-2  started    2026-06-16 07:05:20\n  VPX-3  restarted  2026-06-18 14:00:00 (admin)',
  'show vm lifecycle': '> show vm lifecycle\nVM Lifecycle Events:\n  VPX-1  created   2026-01-15\n  VPX-1  started   2026-06-16 07:05:00\n  VPX-2  created   2026-01-15\n  VPX-2  started   2026-06-16 07:05:20',
  'show vm network': '> show vm network\nVM Network Assignments:\n  VPX-1: 0/1 (mgmt, 10.10.10.10) + 0/2 (data, trunk VLAN 10,20)\n  VPX-2: 0/1 (mgmt, 10.10.10.11) + 0/2 (data, trunk VLAN 10,20)',
  'show vm resources': '> show vm resources\nVM Resource Usage:\n  VPX-1: CPU 2/2  Mem 3800/4096MB  Disk 22.5/50GB\n  VPX-2: CPU 2/2  Mem 2048/4096MB  Disk 18.1/50GB\n  VPX-3: CPU 4/4  Mem 6000/8192MB  Disk 62.1/100GB',
  'show vm snapshot': '> show vm snapshot\nVM Snapshots:\n  VPX-1  snap-2026-06-20  2026-06-20 14:00  Running  2.3GB\n  VPX-2  snap-2026-06-20  2026-06-20 14:00  Running  2.1GB',
  'show vm history': '> show vm history\nVM Event History (VPX-1):\n  2026-06-21 09:35: CPU usage 28% (normal)\n  2026-06-20 03:00: Maintenance snapshot created\n  2026-06-16 07:05: VM started after system boot',
  'show vpx allocation': '> show vpx allocation\nVPX Resource Allocation (total capacity):\n  CPU:    12 vCPUs allocated / 28 available\n  Memory: 18432 MB allocated / 47104 MB available\n  Disk:   200 GB allocated / 300 GB available',
  'show vpx config': '> show vpx config VPX-1\nVPX-1 Configuration:\n  vCPUs:   2  Pinned to cores: 2,3\n  Memory:  4096 MB\n  Disk:    50 GB\n  NSIP:    10.10.10.10/24\n  GW:      10.10.10.1\n  Image:   NSVPX-KVM-13.1-42.47',
  'show hardware fans': '> show hardware fans\nFan Status:\n  Fan 0: 4200 RPM  OK  (min: 2000 RPM)\n  Fan 1: 4150 RPM  OK\n  Fan 2: 4220 RPM  OK\n  Fan 3: 4180 RPM  OK',
  'show hardware power': '> show hardware power\nPower Status:\n  PSU 0: OK  Input: 120V AC  Output: 250W  Status: Active\n  PSU 1: OK  Input: 120V AC  Output: 248W  Status: Active\n  Total: 498W  Redundancy: Full',
  'show hardware network': '> show hardware network\nNetwork Hardware:\n  NIC 0: Intel I350  4x 1GbE copper  Ports: 0/1-0/4\n  NIC 1: Intel X550  2x 10GbE SFP+  Ports: 10/1-10/2\n  SSL:   Cavium Nitrox III  2 chips',
  'show hardware disk': '> show hardware disk\nDisk Hardware:\n  Disk 0 (sda): Samsung SSD 870EVO 500GB  S/N: S234AB  Temp: 38°C  SMART: OK\n  Disk 1 (sdb): Samsung SSD 870EVO 500GB  S/N: S234CD  Temp: 37°C  SMART: OK\n  RAID: Controller MD (software)  Mode: RAID-1',
  'show hardware ssl': '> show hardware ssl\nSSL Acceleration Hardware:\n  Chip 0: Cavium Nitrox III CN1620\n    TPS: 1024 (RSA-2048)  Status: OK  Temp: 52°C\n  Chip 1: Cavium Nitrox III CN1620\n    TPS: 1024 (RSA-2048)  Status: OK  Temp: 51°C',
  'show hardware backplane': '> show hardware backplane\nBackplane Hardware:\n  Type:   Citrix SDX Fabric\n  Links:  2 x 10Gbps\n  State:  Active (both links UP)\n  Latency: < 1µs',
};

let added = 0, skipped = 0;
for (const platformData of Object.values(data.platforms)) {
  for (const cmds of Object.values(platformData.sections)) {
    for (const cmd of cmds) {
      if (!cmd.example && EXAMPLES[cmd.cmd] !== undefined) {
        cmd.example = EXAMPLES[cmd.cmd];
        added++;
      } else if (!cmd.example) {
        skipped++;
      }
    }
  }
}

data.updatedAt = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n');
console.log(`Pass 5 done. Added: ${added}  Still missing: ${skipped}`);
