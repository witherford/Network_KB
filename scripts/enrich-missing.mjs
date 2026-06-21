#!/usr/bin/env node
/**
 * Adds examples to commands missing them, and inserts 10 new commands.
 * Run: node scripts/enrich-missing.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const PATH = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(PATH, 'utf8'));

// ─── EXAMPLE LOOKUP (cmd → example string) ────────────────────────────────
const EXAMPLES = {

  // ── Linux Ref 01. File & Directory Navigation ──────────────────────────
  'ls -R': '$ ls -R /etc/network\n/etc/network:\nif-down.d  if-post-down.d  if-pre-up.d  if-up.d  interfaces\n/etc/network/if-up.d:\nethtool  openssh-server',
  'cd /path': '$ cd /var/log\n$ pwd\n/var/log',
  'cd ..': '$ pwd\n/var/log/apt\n$ cd ..\n$ pwd\n/var/log',
  'cd -': '$ pwd\n/home/user\n$ cd /var/log\n$ cd -\n/home/user',
  'cd ~': '$ cd ~\n$ pwd\n/home/user',
  'cd /': '$ cd /\n$ pwd\n/',
  'tree': '$ tree /etc/ssh\n/etc/ssh\n├── sshd_config\n├── sshd_config.d\n│   └── 50-cloud-init.conf\n└── ssh_host_rsa_key',
  'tree -L 3': '$ tree -L 3 /var\n/var\n├── backups\n│   └── dpkg.status.0\n├── cache\n│   └── apt\n│       ├── archives\n│       └── pkgcache.bin\n└── log',
  'basename /path/to/file': '$ basename /var/log/syslog\nsyslog\n$ basename /etc/nginx/nginx.conf\nnginx.conf',
  'dirname /path/to/file': '$ dirname /var/log/syslog\n/var/log\n$ dirname /etc/nginx/nginx.conf\n/etc/nginx',

  // ── Linux Ref 02. File Creation, Copying, Moving, Deletion ─────────────
  'mv -i old new': '$ mv -i report.txt report_backup.txt\nmv: overwrite \'report_backup.txt\'? y',
  'mv --no-clobber old new': '$ mv --no-clobber data.csv data_old.csv\n# silently skips if data_old.csv already exists',
  'rm file': '$ rm /tmp/session.lock\n# removes file permanently',
  'rm -i file': '$ rm -i important.conf\nrm: remove regular file \'important.conf\'? n',
  'mkdir dir': '$ mkdir /tmp/staging\n$ ls /tmp/staging\n(empty)',
  'mkdir --mode=755 dir': '$ mkdir --mode=755 /opt/myapp\n$ stat -c "%a %n" /opt/myapp\n755 /opt/myapp',
  'install -m 755 script.sh /usr/local/bin/': '$ install -m 755 deploy.sh /usr/local/bin/\n$ ls -l /usr/local/bin/deploy.sh\n-rwxr-xr-x 1 root root 1024 Jun 21 09:00 /usr/local/bin/deploy.sh',
  'truncate -s 0 logfile': '$ truncate -s 0 /var/log/app.log\n$ wc -c /var/log/app.log\n0 /var/log/app.log',
  'truncate -s 1G bigfile': '$ truncate -s 1G testfile.img\n$ ls -lh testfile.img\n-rw-r--r-- 1 user user 1.0G Jun 21 09:01 testfile.img',
  'shred -u file': '$ shred -u sensitive.key\n# overwrites then removes sensitive.key',
  'shred -n 10 file': '$ shred -n 10 old_certs.pem\n# 10 overwrite passes on old_certs.pem without removal',

  // ── Linux Ref 03. Viewing & Searching File Content ─────────────────────
  'hexdump -C file': '$ hexdump -C /etc/hostname | head -2\n00000000  72 6f 75 74 65 72 31 0a                           |router1.|\n00000008',
  'od -c file': '$ od -c /etc/hostname\n0000000   r   o   u   t   e   r   1  \\n\n0000010',
  'nl file': '$ nl /etc/hosts | head -5\n     1\t127.0.0.1   localhost\n     2\t127.0.1.1   myhost\n     3\t::1         localhost',
  'grep -n pattern file': '$ grep -n "error" /var/log/syslog | head -3\n142:Jun 21 09:05:11 host kernel: [ERROR] disk I/O\n387:Jun 21 09:12:44 host systemd[1]: error starting sshd',
  'grep -l pattern *': '$ grep -l "PermitRootLogin" /etc/ssh/*\n/etc/ssh/sshd_config',
  'grep -c pattern file': '$ grep -c "FAILED" /var/log/auth.log\n47',
  'grep -w word file': '$ grep -w "root" /etc/passwd | head -2\nroot:x:0:0:root:/root:/bin/bash',
  'grep -A3 pattern file': '$ grep -A3 "Interface" /etc/network/interfaces\nInterface eth0\n  address 192.168.1.10\n  netmask 255.255.255.0\n  gateway 192.168.1.1',
  'grep -B3 pattern file': '$ grep -B3 "failed" /var/log/auth.log | head -8\nJun 21 10:01:01 host sshd[1234]: pam_unix(sshd:auth): check pass\nJun 21 10:01:01 host sshd[1234]: pam_unix(sshd:auth): authentication failure\nJun 21 10:01:03 host sshd[1234]: Failed password for invalid user admin',
  'grep -C3 pattern file': '$ grep -C3 "panic" /var/log/kern.log | head\n[context lines before and after each "panic" match]',

  // ── Linux Ref 04. Archives & Compression ───────────────────────────────
  'tar -czf archive.tar.gz dir': '$ tar -czf backup-2026-06-21.tar.gz /var/www\n$ ls -lh backup-2026-06-21.tar.gz\n-rw-r--r-- 1 root root 45M Jun 21 09:15 backup-2026-06-21.tar.gz',
  'tar -xzf archive.tar.gz': '$ tar -xzf backup-2026-06-21.tar.gz -C /restore/\n$ ls /restore/var/www\nhtml  conf',
  'tar -tvf archive.tar': '$ tar -tvf backup.tar | head -5\n-rw-r--r-- root/root   4096 2026-06-20 /var/www/html/index.html\n-rw-r--r-- root/root   1234 2026-06-20 /var/www/conf/nginx.conf',
  'tar --exclude=*.log -czf archive.tar.gz dir': '$ tar --exclude=*.log -czf app.tar.gz /opt/app\n# /opt/app/*.log files excluded',
  'tar -cpf archive.tar dir': '$ tar -cpf system-backup.tar /etc\n$ ls -lh system-backup.tar\n-rw-r--r-- 1 root root 12M Jun 21 system-backup.tar',
  'tar --strip-components=1 -xzf archive.tar.gz': '$ tar --strip-components=1 -xzf project-v2.tar.gz\n# strips leading directory, extracts contents directly',
  'tar --lzma -cf archive.tar.lzma dir': '$ tar --lzma -cf archive.tar.lzma bigdir/\n# creates lzma-compressed archive (smaller than gzip)',
  'zip file.zip file1 file2': '$ zip configs.zip nginx.conf sshd_config\n  adding: nginx.conf (deflated 62%)\n  adding: sshd_config (deflated 58%)',
  'zip -r dir.zip dir': '$ zip -r website.zip /var/www/html\n  adding: var/www/html/index.html (deflated 71%)\n  adding: var/www/html/style.css (deflated 68%)',
  'zip -9 file.zip file': '$ zip -9 compressed.zip largefile.txt\n  adding: largefile.txt (deflated 89%)',
  'unzip file.zip': '$ unzip backup.zip -d /restore/\nArchive:  backup.zip\n  inflating: /restore/nginx.conf\n  inflating: /restore/sshd_config',
  'unzip -l file.zip': '$ unzip -l backup.zip\nArchive:  backup.zip\n  Length      Date    Time    Name\n--------  ---------- -----   ----\n    4096  2026-06-20 09:00   nginx.conf\n    2048  2026-06-20 09:00   sshd_config',
  'unzip -o file.zip': '$ unzip -o update.zip -d /opt/app/\n# overwrites existing files without prompting',
  'gzip file': '$ gzip access.log\n$ ls\naccess.log.gz',
  'gzip -9 file': '$ gzip -9 archive.tar\n# maximum compression; produces archive.tar.gz',
  'gzip -k file': '$ gzip -k syslog\n# keeps original; produces syslog.gz alongside syslog',
  'xz -9 file': '$ xz -9 bigdump.sql\n$ ls -lh bigdump.sql.xz\n-rw-r--r-- 1 root root 8.2M Jun 21 bigdump.sql.xz',
  'xz -d file.xz': '$ xz -d bigdump.sql.xz\n$ ls\nbigdump.sql',
  'xz -k file': '$ xz -k bigdump.sql\n# keeps original; produces bigdump.sql.xz',
  'xz -T0 file': '$ xz -T0 -9 huge.tar\n# uses all CPU threads for parallel compression',

  // ── Linux Ref 05. System Information & Monitoring ──────────────────────
  'du -sh dir': '$ du -sh /var/log\n1.2G\t/var/log',
  'du -sh *': '$ du -sh /var/*\n4.0K\t/var/backups\n1.2G\t/var/log\n240M\t/var/cache',
  'du -ah dir': '$ du -ah /var/log | sort -h | tail -5\n4.0K\t/var/log/dpkg.log.1\n6.8M\t/var/log/syslog\n45M\t/var/log/kern.log\n1.2G\t/var/log',
  'du -x / | sort -n': '$ du -x / 2>/dev/null | sort -n | tail -10\n524288\t/usr/lib\n1048576\t/var/log\n2097152\t/usr',
  'ps -eo pid,ppid,cmd,%mem,%cpu': '$ ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -5\n  PID  PPID CMD                         %MEM %CPU\n 1234     1 /usr/sbin/mysqld             8.2  45.3\n  891     1 /usr/bin/python3 app.py      2.1  12.0',
  'ps --sort=-%cpu': '$ ps --sort=-%cpu -eo pid,cmd,%cpu | head -5\n  PID CMD                         %CPU\n 1234 /usr/sbin/mysqld              45.3\n  891 python3 app.py                12.0',
  'ps --sort=-%mem': '$ ps --sort=-%mem -eo pid,cmd,%mem | head -5\n  PID CMD                         %MEM\n 1234 /usr/sbin/mysqld               8.2\n  756 /usr/lib/firefox/firefox        6.4',
  'kill pid': '$ kill 1234\n# sends SIGTERM to PID 1234',
  'kill -9 pid': '$ kill -9 1234\n# sends SIGKILL (force kill) to PID 1234',
  'killall process': '$ killall nginx\n# sends SIGTERM to all nginx processes',

  // ── Linux Ref 06. Networking Commands ──────────────────────────────────
  'curl -I url': '$ curl -I https://example.com\nHTTP/2 200\ncontent-type: text/html; charset=UTF-8\ncontent-length: 1256\nserver: nginx/1.24.0',
  'curl -L url': '$ curl -L http://example.com -o page.html\n# follows redirects; final response saved to page.html',
  'curl -O url': '$ curl -O https://releases.ubuntu.com/22.04/ubuntu-22.04.iso\n# saves file using remote filename',
  'curl --compressed url': '$ curl --compressed https://api.example.com/data\n# requests and decompresses gzip/deflate response',
  'curl --retry 5 url': '$ curl --retry 5 --retry-delay 3 https://example.com\n# retries up to 5 times with 3-second delay on failure',
  'wget url': '$ wget https://example.com/file.tar.gz\n--2026-06-21 09:30:01--  https://example.com/file.tar.gz\nResolving example.com... 93.184.216.34\nConnecting... connected.\nHTTP request sent, 200 OK\n100%[============================>] 45.2M  5.12MB/s in 8.8s',
  'wget -c url': '$ wget -c https://example.com/largefile.iso\n# resumes an interrupted download from where it stopped',
  'wget --tries=5 url': '$ wget --tries=5 --waitretry=10 https://example.com/file.tar.gz\n# retries 5 times, waiting 10s between attempts',
  'ss -an': '$ ss -an | head -8\nNetid  State    Recv-Q  Send-Q   Local Address:Port   Peer Address:Port\ntcp    LISTEN   0       128      0.0.0.0:22            0.0.0.0:*\ntcp    ESTAB    0       0        192.168.1.5:22        10.0.0.1:54321',
  'ssh user@host': '$ ssh admin@192.168.1.1\nadmin@192.168.1.1\'s password:\nLast login: Fri Jun 20 14:32:01 2026 from 10.0.0.5\n$',
  'ssh -i key user@host': '$ ssh -i ~/.ssh/id_ed25519 ubuntu@203.0.113.5\nWelcome to Ubuntu 22.04.3 LTS\n$',
  'ssh -p 2222 user@host': '$ ssh -p 2222 admin@192.168.1.1\n# connects via non-standard SSH port 2222',

  // ── Linux Ref 07. Package Management (APT) ─────────────────────────────
  'sudo apt update': '$ sudo apt update\nHit:1 http://archive.ubuntu.com/ubuntu jammy InRelease\nGet:2 http://archive.ubuntu.com/ubuntu jammy-updates InRelease [119 kB]\nFetched 2,345 kB in 3s\nReading package lists... Done',
  'sudo apt upgrade': '$ sudo apt upgrade\nReading package lists... Done\nBuilding dependency tree... Done\n5 upgraded, 0 newly installed, 0 to remove\nNeed to get 12.3 MB of archives.',
  'sudo apt install pkg': '$ sudo apt install nginx\nThe following NEW packages will be installed: nginx nginx-common\n0 upgraded, 2 newly installed.\nDo you want to continue? [Y/n] Y',
  'sudo apt install -y pkg': '$ sudo apt install -y curl\n# installs without interactive prompt',
  'sudo apt install pkg=version': '$ sudo apt install nginx=1.18.0-0ubuntu1\n# installs specific version of nginx',
  'sudo apt remove pkg': '$ sudo apt remove nginx\nThe following packages will be REMOVED: nginx\n0 upgraded, 0 newly installed, 1 to remove.\nDo you want to continue? [Y/n] Y',
  'sudo apt purge pkg': '$ sudo apt purge nginx\n# removes package AND its configuration files',
  'sudo apt autoremove': '$ sudo apt autoremove\nThe following packages will be REMOVED: linux-image-5.15.0-89-generic\n0 upgraded, 0 newly installed, 1 to remove.\nDo you want to continue? [Y/n] Y',
  'sudo apt autoremove --purge': '$ sudo apt autoremove --purge\n# removes orphaned packages and their config files',
  'sudo apt full-upgrade': '$ sudo apt full-upgrade\n# like upgrade but also removes obsoleting packages if needed',
  'apt search term': '$ apt search "web server"\nSorting... Done\nnginx/jammy-updates 1.18.0-6ubuntu14.5 amd64\n  high performance web server',
  'apt show pkg': '$ apt show nginx\nPackage: nginx\nVersion: 1.18.0-6ubuntu14.5\nDepends: libnginx-mod-http-gzip-static, nginx-common\nDescription: small, powerful, scalable web/proxy server',
  'apt list --installed': '$ apt list --installed 2>/dev/null | head -5\nListing... Done\ncurl/jammy-updates,now 7.81.0-1ubuntu1.16 amd64 [installed]\nnginx/jammy-updates,now 1.18.0-6ubuntu14.5 amd64 [installed]',
  'apt list --upgradable': '$ apt list --upgradable 2>/dev/null\nListing... Done\nopenssl/jammy-updates 3.0.2-0ubuntu1.18 amd64 [upgradable from: 3.0.2-0ubuntu1.15]',
  'apt-cache policy pkg': '$ apt-cache policy nginx\nnginx:\n  Installed: 1.18.0-6ubuntu14.5\n  Candidate: 1.18.0-6ubuntu14.5\n  Version table:\n *** 1.18.0-6ubuntu14.5 500',
  'apt-cache depends pkg': '$ apt-cache depends nginx\nnginx\n  Depends: libnginx-mod-http-gzip-static\n  Depends: nginx-common',
  'apt-cache rdepends pkg': '$ apt-cache rdepends nginx-common\nnginx-common\nReverse Depends:\n  nginx-full\n  nginx',
  'dpkg -l': '$ dpkg -l | grep nginx\nii  nginx          1.18.0-6ubuntu14.5   amd64   high performance web server\nii  nginx-common   1.18.0-6ubuntu14.5   all     small, powerful web server',
  'dpkg -s pkg': '$ dpkg -s nginx\nPackage: nginx\nStatus: install ok installed\nVersion: 1.18.0-6ubuntu14.5\nInstalled-Size: 43',
  'dpkg -L pkg': '$ dpkg -L nginx | head -8\n/.\n/etc\n/etc/nginx\n/etc/nginx/nginx.conf\n/usr/sbin/nginx',
  'dpkg -i file.deb': '$ sudo dpkg -i mypackage_1.0_amd64.deb\nSelecting previously unselected package mypackage.\nPreparing to unpack mypackage_1.0_amd64.deb ...\nUnpacking mypackage (1.0) ...\nSetting up mypackage (1.0) ...',
  'dpkg -r pkg': '$ sudo dpkg -r nginx\n# removes nginx package (keeps config files)',
  'dpkg --configure -a': '$ sudo dpkg --configure -a\n# finishes configuration of any partially-installed packages',
  'apt --fix-broken install': '$ sudo apt --fix-broken install\n# resolves and installs missing dependencies',
  'dpkg -S /path/to/file': '$ dpkg -S /usr/sbin/nginx\nnginx: /usr/sbin/nginx',
  'apt-mark hold pkg': '$ sudo apt-mark hold nginx\nnginx set on hold.',
  'apt-mark unhold pkg': '$ sudo apt-mark unhold nginx\nCanceled hold on nginx.',
  'apt clean': '$ sudo apt clean\n# removes all cached .deb files from /var/cache/apt/archives/',
  'apt autoclean': '$ sudo apt autoclean\n# removes only obsolete cached .deb files',

  // ── Linux Ref 08. User & Permissions Management ────────────────────────
  'chmod g-w file': '$ chmod g-w /etc/app.conf\n$ ls -l /etc/app.conf\n-rw-r--r-- 1 root root 1024 Jun 21 app.conf',
  'chmod o-rwx file': '$ chmod o-rwx private.key\n$ ls -l private.key\n-rw-r----- 1 user group 1679 Jun 21 private.key',
  'chmod -R 755 dir': '$ chmod -R 755 /var/www/html\n# sets rwxr-xr-x recursively on /var/www/html',
  'sudo passwd user': '$ sudo passwd alice\nNew password:\nRetype new password:\npasswd: password updated successfully',
  'sudo useradd -m user': '$ sudo useradd -m bob\n$ ls /home/bob\n# home directory created with default skeleton',
  'sudo useradd -m -s /bin/bash user': '$ sudo useradd -m -s /bin/bash carol\n# creates user with bash shell and home directory',
  'sudo userdel user': '$ sudo userdel bob\n# removes user account, keeps home directory',
  'sudo userdel -r user': '$ sudo userdel -r carol\n# removes user account AND home directory',
  'sudo usermod -aG group user': '$ sudo usermod -aG docker alice\n# adds alice to docker group (append, keeps existing groups)',
  'sudo usermod -L user': '$ sudo usermod -L alice\n# locks alice\'s password (disables login)',

  // ── Linux Ref 09. Systemd Service Management ───────────────────────────
  'systemctl reload-or-restart service': '$ systemctl reload-or-restart nginx\n# reloads config if supported, otherwise full restart',
  'systemctl mask service': '$ systemctl mask bluetooth\nCreated symlink /etc/systemd/system/bluetooth.service → /dev/null.\n# prevents service from starting by any means',
  'systemctl unmask service': '$ systemctl unmask bluetooth\nRemoved /etc/systemd/system/bluetooth.service.\n# restores ability to enable/start the service',
  'systemctl is-enabled service': '$ systemctl is-enabled nginx\nenabled',
  'systemctl is-failed service': '$ systemctl is-failed nginx\nactive\n# returns "failed" if in failed state',
  'systemctl list-units': '$ systemctl list-units --type=service --state=active | head -8\nUNIT                    LOAD   ACTIVE SUB     DESCRIPTION\ncron.service            loaded active running Regular background jobs\nnginx.service           loaded active running A high performance web server\nssh.service             loaded active running OpenBSD Secure Shell server',
  'systemctl list-unit-files': '$ systemctl list-unit-files --type=service | head -8\nUNIT FILE                     STATE\ncron.service                  enabled\nnginx.service                 enabled\noptional-service.service      disabled',
  'systemctl daemon-reload': '$ systemctl daemon-reload\n# re-reads all unit files; run after editing /etc/systemd/system/*.service',
  'systemctl daemon-reexec': '$ systemctl daemon-reexec\n# re-executes systemd manager itself (used after systemd binary update)',
  'systemctl cat service': '$ systemctl cat nginx\n# /lib/systemd/system/nginx.service\n[Unit]\nDescription=A high performance web server\nAfter=network.target\n[Service]\nType=forking\nPIDFile=/run/nginx.pid\nExecStart=/usr/sbin/nginx',

  // ── Linux Ref 10. Storage, Mounting & Filesystems ──────────────────────
  'lsblk': '$ lsblk\nNAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0    50G  0 disk\n├─sda1   8:1    0     1G  0 part /boot/efi\n├─sda2   8:2    0     2G  0 part /boot\n└─sda3   8:3    0    47G  0 part /\nsdb      8:16   0   100G  0 disk',
  'lsblk -o NAME,SIZE,TYPE,MOUNTPOINT': '$ lsblk -o NAME,SIZE,TYPE,MOUNTPOINT\nNAME    SIZE TYPE MOUNTPOINT\nsda      50G disk\n├─sda1    1G part /boot/efi\n├─sda2    2G part /boot\n└─sda3   47G part /\nsdb     100G disk',
  'mount device dir': '$ mount /dev/sdb1 /mnt/data\n$ df -h /mnt/data\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/sdb1        99G  1.2G   93G   2% /mnt/data',
  'mount -o ro device dir': '$ mount -o ro /dev/sdb1 /mnt/backup\n# mounts read-only; writes will be rejected',
  'mount -o noatime device dir': '$ mount -o noatime /dev/sdb1 /mnt/data\n# disables access-time updates; improves performance on SSDs',
  'umount /mnt': '$ umount /mnt/data\n# unmounts the filesystem at /mnt/data',
  'findmnt': '$ findmnt --real\nTARGET         SOURCE    FSTYPE  OPTIONS\n/              /dev/sda3 ext4    rw,relatime\n/boot          /dev/sda2 ext4    rw,relatime\n/boot/efi      /dev/sda1 vfat    rw,relatime',
  'blkid': '$ blkid\n/dev/sda1: UUID="ABCD-1234" TYPE="vfat"\n/dev/sda2: UUID="1234abcd-..." TYPE="ext4"\n/dev/sdb1: UUID="5678efgh-..." TYPE="xfs"',
  'e2fsck -f /dev/sda1': '$ e2fsck -f /dev/sdb1\ne2fsck 1.46.5 (30-Dec-2021)\nPass 1: Checking inodes, blocks, and sizes\nPass 5: Checking group summary information\n/dev/sdb1: 125/6553600 files, 198344/26214400 blocks',
  'tune2fs -l /dev/sda1': '$ tune2fs -l /dev/sda3\ntune2fs 1.46.5\nFilesystem volume name:   <none>\nLast mounted on:          /\nFilesystem state:         clean\nBlock count:              12288000\nFree blocks:              8234521',

  // ── Linux Ref 11. Logs & Debugging ─────────────────────────────────────
  'journalctl -n 100': '$ journalctl -n 100\n-- Logs begin at Mon 2026-06-01, end at Sat 2026-06-21 --\nJun 21 09:00:01 host systemd[1]: Started Session 42 of User root.\nJun 21 09:05:12 host sshd[1234]: Accepted publickey for admin',
  'journalctl --since "1 hour ago"': '$ journalctl --since "1 hour ago"\n-- Logs begin at Mon 2026-06-01, end at Sat 2026-06-21 --\nJun 21 08:30:01 host CRON[987]: pam_unix(cron:session): session opened\nJun 21 08:45:22 host kernel: eth0: renamed from veth3a2b1c',
  'journalctl --since yesterday': '$ journalctl --since yesterday --until today\n# shows all logs from yesterday midnight to now',
  'dmesg --ctime': '$ dmesg --ctime | tail -5\n[Sat Jun 21 08:00:01 2026] EXT4-fs (sda3): mounted filesystem\n[Sat Jun 21 08:00:02 2026] NET: Registered PF_INET6 protocol family',
  'dmesg --level=err': '$ dmesg --level=err\n[  5.234] ata1.00: exception Emask 0x10 action 0x1\n[  5.235] ata1.00: cmd 60/01:00:00:00:00-40 tag 0\n[  5.235] ata1.00: status: { DRDY ERR }',
  'journalctl -u service': '$ journalctl -u nginx --since "2 hours ago"\nJun 21 07:30:01 host nginx[2222]: Starting nginx\nJun 21 07:30:01 host nginx[2222]: nginx: configuration file /etc/nginx/nginx.conf test ok',
  'journalctl -p err': '$ journalctl -p err --since today\nJun 21 08:05:11 host kernel: [22.341567] usb 1-1: device not accepting address 5, error -71\nJun 21 08:12:44 host systemd[1]: Failed to start iscsi.service',
  'journalctl --disk-usage': '$ journalctl --disk-usage\nArchived and active journals take up 1.2 GiB in the file system.',
  'journalctl --vacuum-time=7d': '$ journalctl --vacuum-time=7d\nVacuuming done, freed 345.2 MiB of archived journals from /var/log/journal/.',
  'dmesg | grep -i eth': '$ dmesg | grep -i eth\n[    2.456] e1000e 0000:00:19.0 eth0: renamed from\n[    2.457] e1000e 0000:00:19.0 ens3: NIC Link is Up 1000 Mbps Full Duplex',

  // ── Linux Ref 12. Text Processing ──────────────────────────────────────
  'sort -u file': '$ sort -u /etc/shells\n/bin/bash\n/bin/dash\n/bin/sh\n/usr/bin/fish\n/usr/bin/zsh',
  'sort -t: -k3n /etc/passwd': '$ sort -t: -k3n /etc/passwd | head -5\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin',
  'uniq -d file': '$ sort access.log | uniq -d\n192.168.1.5  GET /api/health\n192.168.1.10 GET /login\n# shows only lines that appear more than once',
  'uniq -u file': '$ sort messages.log | uniq -u\n# shows only lines that appear exactly once',
  "awk '{print $1}' file": "$ awk '{print $1}' /var/log/nginx/access.log | head -5\n192.168.1.5\n10.0.0.1\n172.16.0.2\n192.168.1.10\n10.0.0.5",
  "awk '{sum+=$1} END{print sum}' file": "$ awk '{sum+=$5} END{print \"Total bytes:\", sum}' access.log\nTotal bytes: 5432198",
  "awk -F: '{print $1,$3}' /etc/passwd": "$ awk -F: '{print $1,$3}' /etc/passwd | head -5\nroot 0\ndaemon 1\nbin 2\nsys 3",
  "sed 's/old/new/g' file": "$ sed 's/localhost/127.0.0.1/g' app.conf\n# prints with all occurrences of localhost replaced",
  "sed -i 's/old/new/g' file": "$ sed -i 's/http:/https:/g' config.txt\n# in-place replacement; updates config.txt directly",
  "sed -n '5,10p' file": "$ sed -n '5,10p' /var/log/syslog\n# prints only lines 5 through 10",

  // ── Linux Ref 13. Network Troubleshooting ──────────────────────────────
  'tracepath host': '$ tracepath 8.8.8.8\n 1?: [LOCALHOST]                      pmtu 1500\n 1:  192.168.1.1                         0.812ms\n 2:  10.0.0.1                            3.214ms\n 3:  8.8.8.8                             12.301ms reached',
  'traceroute -n host': '$ traceroute -n 8.8.8.8\ntraceroute to 8.8.8.8, 30 hops max\n 1  192.168.1.1    1.234 ms\n 2  10.0.0.1       4.567 ms\n 3  8.8.8.8       12.890 ms',
  'dig host': '$ dig example.com\n;; ANSWER SECTION:\nexample.com.    3600  IN  A  93.184.216.34\n;; Query time: 12 msec\n;; SERVER: 8.8.8.8#53(8.8.8.8)',
  'dig +short host': '$ dig +short example.com\n93.184.216.34',
  'dig ANY host': '$ dig ANY example.com\n;; ANSWER SECTION:\nexample.com.  3600  IN  A     93.184.216.34\nexample.com.  3600  IN  MX    10 mail.example.com.\nexample.com.  3600  IN  NS    ns1.example.com.',
  'dig @8.8.8.8 host': '$ dig @8.8.8.8 example.com +short\n93.184.216.34\n# queries Google DNS directly instead of system resolver',
  'nslookup host': '$ nslookup example.com\nServer:   8.8.8.8\nAddress:  8.8.8.8#53\nName:   example.com\nAddress: 93.184.216.34',
  'mtr host': '$ mtr --report 8.8.8.8\nHOST: myhost                Loss%  Snt  Last  Avg  Best  Wrst StDev\n  1.|-- 192.168.1.1          0.0%   10  0.8   0.9  0.7   1.2   0.1\n  2.|-- 8.8.8.8              0.0%   10 12.3  12.5 12.0  13.2   0.4',
  'arp -n': '$ arp -n\nAddress          HWtype  HWaddress           Flags Iface\n192.168.1.1      ether   aa:bb:cc:dd:ee:ff   C     eth0\n192.168.1.5      ether   11:22:33:44:55:66   C     eth0',
  'netstat -r': '$ netstat -r\nKernel IP routing table\nDestination  Gateway      Genmask        Flags Iface\n0.0.0.0      192.168.1.1  0.0.0.0        UG    eth0\n192.168.1.0  0.0.0.0      255.255.255.0  U     eth0',

  // ── Linux Ref 14. System Maintenance & Cleanup ─────────────────────────
  'apt autoremove --purge': '$ sudo apt autoremove --purge\nThe following packages will be REMOVED: linux-image-5.15.0-89-generic linux-modules-5.15.0-89-generic\n0 upgraded, 0 newly installed, 2 to remove.\nAfter this operation, 412 MB disk space will be freed.',
  'journalctl --vacuum-size=200M': '$ sudo journalctl --vacuum-size=200M\nVacuuming done, freed 987.4 MiB of archived journals from /var/log/journal/.',
  'crontab -e': '$ crontab -e\n# opens crontab in default editor\n# Example: run backup daily at 2am:\n# 0 2 * * * /usr/local/bin/backup.sh',
  'updatedb': '$ sudo updatedb\n# updates the mlocate database for fast file searching',
  'locate file': '$ locate nginx.conf\n/etc/nginx/nginx.conf\n/etc/nginx/sites-available/default',
  'find / -type f -name "*.tmp" -delete': '$ find /tmp -type f -name "*.tmp" -delete\n# deletes all .tmp files in /tmp',
  'fstrim -v /': '$ sudo fstrim -v /\n/: 14.8 GiB (15887335424 bytes) trimmed\n# TRIM command for SSD optimization',
  'sync': '$ sync\n# flushes all pending writes to disk',
  'logrotate -f /etc/logrotate.conf': '$ sudo logrotate -f /etc/logrotate.conf\n# forces an immediate log rotation cycle',
  'dpkg --audit': '$ dpkg --audit\n# reports packages in broken/partially-installed state',

  // ── Linux Ref 15. Firewall (UFW) ────────────────────────────────────────
  'sudo ufw status': '$ sudo ufw status\nStatus: active\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW       Anywhere\n80/tcp                     ALLOW       Anywhere\n443/tcp                    ALLOW       Anywhere',
  'sudo ufw status numbered': '$ sudo ufw status numbered\nStatus: active\n\n     To             Action      From\n     --             ------      ----\n[ 1] 22/tcp         ALLOW IN    Anywhere\n[ 2] 80/tcp         ALLOW IN    Anywhere\n[ 3] 443/tcp        ALLOW IN    Anywhere',
  'sudo ufw enable': '$ sudo ufw enable\nCommand may disrupt existing ssh connections. Proceed with operation (y|n)? y\nFirewall is active and enabled on system startup',
  'sudo ufw disable': '$ sudo ufw disable\nFirewall stopped and disabled on system startup',
  'sudo ufw reset': '$ sudo ufw reset\nResetting all rules to installed defaults. Proceed with operation (y|n)? y\n# all rules cleared, ufw disabled',
  'sudo ufw allow 22/tcp': '$ sudo ufw allow 22/tcp\nRule added\nRule added (v6)',
  'sudo ufw allow from 10.0.0.0/8': '$ sudo ufw allow from 10.0.0.0/8 to any port 443\nRule added',
  'sudo ufw deny 23': '$ sudo ufw deny 23\nRule added\nRule added (v6)\n# blocks Telnet',
  'sudo ufw delete 2': '$ sudo ufw delete 2\nDeleting:\n allow 80/tcp\nProceed with operation (y|n)? y\nRule deleted',
  'sudo ufw logging on': '$ sudo ufw logging on\nLogging enabled\n# UFW log events appear in /var/log/ufw.log',

  // ── Linux Ref 16. Process Control & Job Management ─────────────────────
  'jobs': '$ jobs\n[1]-  Running    tar -czf backup.tar.gz /var/www &\n[2]+  Stopped    vim config.txt',
  'bg %1': '$ bg %1\n[1]+ tar -czf backup.tar.gz /var/www &\n# resumes job 1 in background',
  'fg %1': '$ fg %1\ntar -czf backup.tar.gz /var/www\n# brings job 1 to foreground',
  'nice -n 10 cmd': '$ nice -n 10 make -j4\n# runs make with lower priority (niceness 10)',
  'nice -n -5 cmd': '$ sudo nice -n -5 rsync -avz /src/ /dest/\n# runs rsync at higher priority (negative nice, requires root)',
  'renice -n 5 -p pid': '$ renice -n 5 -p 1234\n1234 (process ID) old priority 0, new priority 5',
  'nohup cmd &': '$ nohup ./long-script.sh > /tmp/out.log 2>&1 &\n[1] 12345\n# process continues after logout; output to /tmp/out.log',
  'disown %1': '$ disown %1\n# detaches job 1 from shell; keeps running after logout',
  'wait': '$ wait\n# waits for all background jobs to complete before continuing',

  // ── Linux Ref 17. Advanced Networking ──────────────────────────────────
  'ip addr add 192.168.1.50/24 dev eth0': '$ ip addr add 192.168.1.50/24 dev eth0\n$ ip addr show eth0 | grep "inet "\ninet 192.168.1.10/24 brd 192.168.1.255 scope global eth0\ninet 192.168.1.50/24 scope global secondary eth0',
  'ip addr del 192.168.1.50/24 dev eth0': '$ ip addr del 192.168.1.50/24 dev eth0\n# removes the secondary IP from eth0',
  'ip link set eth0 mtu 9000': '$ ip link set eth0 mtu 9000\n$ ip link show eth0\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000',
  'ip link set eth0 txqueuelen 2000': '$ ip link set eth0 txqueuelen 2000\n# increases TX queue length for high-throughput links',
  'ip addr flush dev eth0': '$ ip addr flush dev eth0\n# removes all IP addresses from eth0',
  'ip rule add from 192.168.2.0/24 table 200': '$ ip rule add from 192.168.2.0/24 table 200\n$ ip rule show\n0:      from all lookup local\n32765:  from 192.168.2.0/24 lookup 200\n32766:  from all lookup main',
  'ip route add default via 10.0.0.1 table 200': '$ ip route add default via 10.0.0.1 table 200\n# adds default route in routing table 200 for policy routing',
  'tc qdisc show': '$ tc qdisc show\nqdisc noqueue 0: dev lo root refcnt 2\nqdisc fq_codel 0: dev eth0 root refcnt 2 limit 10240p flows 1024',
  'ip link add vlan10 link eth0 type vlan id 10': '$ ip link add vlan10 link eth0 type vlan id 10\n$ ip link set vlan10 up\n$ ip addr add 10.10.10.1/24 dev vlan10',
  'ip -s link show eth0': '$ ip -s link show eth0\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    RX:  bytes packets errors dropped\n  4500512   28450      0       0\n    TX:  bytes packets errors dropped\n  1250344   18200      0       0',

  // ── Linux Ref 18. Disk & Partition Management ───────────────────────────
  'parted /dev/sdb mkpart primary ext4 1MiB 100%': '$ parted /dev/sdb mkpart primary ext4 1MiB 100%\nInformation: You may need to update /etc/fstab.\n$ lsblk /dev/sdb\nNAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT\nsdb      8:16   0  100G  0 disk\n└─sdb1   8:17   0  100G  0 part',
  'mkfs.ext4 /dev/sdb1': '$ mkfs.ext4 /dev/sdb1\nmke2fs 1.46.5 (30-Dec-2021)\nCreating filesystem with 26214400 4k blocks and 6553600 inodes\nFilesystem UUID: a1b2c3d4-e5f6-...\nWriting inode tables: done\nCreating journal (131072 blocks): done\nWriting superblocks and filesystem: done',
  'mkfs.fat /dev/sdb1': '$ mkfs.fat -F 32 /dev/sdb1\nmkfs.fat 4.2 (2021-01-31)\n# creates FAT32 filesystem on sdb1 (useful for EFI partitions)',
  'wipefs -a /dev/sdb': '$ wipefs -a /dev/sdb\n/dev/sdb: 8 bytes were erased at offset 0x00000200 (gpt)\n/dev/sdb: 8 bytes were erased at offset 0x06fffffe00 (gpt)\n# clears all filesystem and partition signatures from disk',
  'sgdisk -p /dev/sdb': '$ sgdisk -p /dev/sdb\nDisk /dev/sdb: 209715200 sectors, 100.0 GiB\nPartition table holds up to 128 entries\nNumber  Start       End         Size    Code  Name\n   1    2048        209713151   100.0 GiB 8300  Linux filesystem',
  'gdisk /dev/sdb': '$ gdisk /dev/sdb\nGPT fdisk (gdisk) version 1.0.8\n# interactive GPT partition editor',
  'fdisk -l /dev/sdb': '$ fdisk -l /dev/sdb\nDisk /dev/sdb: 100 GiB, 107374182400 bytes\nDisklabel type: gpt\nDevice     Start       End   Sectors  Size Type\n/dev/sdb1   2048  20973567  20971520   10G Linux filesystem',
  'partprobe /dev/sdb': '$ partprobe /dev/sdb\n# informs kernel of partition table changes without reboot',
  'resize2fs /dev/sdb1': '$ resize2fs /dev/sdb1\nresize2fs 1.46.5\nThe filesystem on /dev/sdb1 is now 13107200 (4k) blocks long.\n# resizes ext4 filesystem to fill partition (after extending LV/partition)',

  // ── Linux Ref 19. LVM ──────────────────────────────────────────────────
  'pvcreate /dev/sdb1': '$ pvcreate /dev/sdb1\n  Physical volume "/dev/sdb1" successfully created.',
  'pvs': '$ pvs\n  PV         VG   Fmt  Attr PSize   PFree\n  /dev/sda3  vg0  lvm2 a--  <47.00g     0\n  /dev/sdb1  vg1  lvm2 a--  <100.00g  50.00g',
  'vgcreate vgname /dev/sdb1': '$ vgcreate datavg /dev/sdb1\n  Volume group "datavg" successfully created',
  'vgs': '$ vgs\n  VG     #PV #LV #SN Attr   VSize    VFree\n  datavg   1   1   0 wz--n- <100.00g  50.00g\n  vg0      1   2   0 wz--n-  <47.00g      0',
  'vgextend vgname /dev/sdc1': '$ vgextend datavg /dev/sdc1\n  Volume group "datavg" successfully extended',
  'lvcreate -L 20G -n lvname vgname': '$ lvcreate -L 20G -n datalv datavg\n  Logical volume "datalv" created.',
  'lvs': '$ lvs\n  LV     VG     Attr       LSize   Pool Origin Data%  Meta%\n  datalv datavg -wi-ao----  20.00g',
  'lvextend -L +10G /dev/vgname/lvname': '$ lvextend -L +10G /dev/datavg/datalv\n  Size of logical volume datavg/datalv changed from 20.00 GiB to 30.00 GiB.\n  Logical volume datavg/datalv successfully resized.',
  'lvdisplay': '$ lvdisplay /dev/datavg/datalv\n  --- Logical volume ---\n  LV Path                /dev/datavg/datalv\n  LV Name                datalv\n  VG Name                datavg\n  LV Status              available\n  LV Size                30.00 GiB',
  'vgreduce vgname /dev/sdc1': '$ vgreduce datavg /dev/sdc1\n  Removed "/dev/sdc1" from volume group "datavg"',
  'pvremove /dev/sdc1': '$ pvremove /dev/sdc1\n  Labels on physical volume "/dev/sdc1" successfully wiped.',

  // ── Linux Ref 20. Backup & Snapshots ───────────────────────────────────
  'rsync -avh src/ dest/': '$ rsync -avh /var/www/ /backup/www/\nsending incremental file list\n./\nhtml/index.html\nconf/nginx.conf\nsent 2.34M bytes  received 38 bytes  1.56M bytes/sec\ntotal size is 45.0M  speedup is 19.23',
  'rsync -avz user@host:/data/ /backup/': '$ rsync -avz admin@10.0.0.5:/opt/app/ /backup/app/\n# compresses data during transfer; useful over slow links',
  'rsync --delete src/ dest/': '$ rsync -av --delete /var/www/ /backup/www/\n# destination mirrors source exactly; extra files in dest deleted',
  'rsync -av --progress src/ dest/': '$ rsync -av --progress /home/user/ /backup/home/\nhome/user/documents/report.pdf\n     2,345,678 100%    5.23MB/s    0:00:00 (xfr#1, to-chk=142/200)',
  'rsync -aAXv / /backup/': '$ rsync -aAXv --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*"} / /backup/\n# full system backup preserving ACLs (A) and extended attrs (X)',
  'dd if=/dev/sda of=/backup/sda.img bs=4M status=progress': '$ dd if=/dev/sda of=/backup/sda.img bs=4M status=progress\n52428800 bytes (52 MB, 50 MiB) copied, 1.234 s, 42.5 MB/s\n# raw disk image; exact byte-for-byte copy',
  'cpio -ov < file.list > backup.cpio': '$ find /etc -type f | cpio -ov > /backup/etc.cpio\n/etc/hosts\n/etc/fstab\n/etc/sshd/sshd_config\n142 blocks',
  'dump -0uf /backup/etc.dump /etc': '$ dump -0uf /backup/etc.dump /etc\nDUMP: Beginning level 0 dump of /etc\nDUMP: Label: none\nDUMP: Writing 10 Kilobyte records',
  'restore -if /backup/etc.dump': '$ restore -if /backup/etc.dump\nrestore > ls\n./etc  ./etc/hosts  ./etc/fstab\nrestore > extract\n# interactive restore from dump file',
  'tar -czf - /var | ssh user@host "cat > /backup/var.tar.gz"': '$ tar -czf - /var/www | ssh admin@backup-host "cat > /backup/www-$(date +%F).tar.gz"\n# streams compressed archive directly to remote host',
  'borgbackup create': '$ borg create --stats --progress /backup/repo::backup-2026-06-21 /home\nArchive name: backup-2026-06-21\nArchive fingerprint: abc123...\nDuration: 1 minutes 23.45 seconds\nNumber of files: 12,345',

  // ── Linux Ref 21. SSH Hardening & Key Management ───────────────────────
  'ssh-keygen -t ed25519': '$ ssh-keygen -t ed25519 -C "user@hostname"\nGenerating public/private ed25519 key pair.\nEnter file in which to save the key (/home/user/.ssh/id_ed25519):\nEnter passphrase (empty for no passphrase):\nYour identification has been saved in /home/user/.ssh/id_ed25519\nYour public key has been saved in /home/user/.ssh/id_ed25519.pub',
  'ssh-keygen -t rsa -b 4096': '$ ssh-keygen -t rsa -b 4096 -C "admin@corp.com"\nGenerating public/private rsa key pair.\nEnter file in which to save the key (/root/.ssh/id_rsa):\nYour identification has been saved in /root/.ssh/id_rsa',
  'ssh-keygen -t ed25519 -a 100': '$ ssh-keygen -t ed25519 -a 100 -f ~/.ssh/id_ed25519_secure\n# -a 100: 100 KDF rounds; makes passphrase brute-force much harder',
  'ssh-copy-id user@host': '$ ssh-copy-id admin@10.0.0.5\n/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "~/.ssh/id_ed25519.pub"\nNumber of key(s) added: 1\nNow try logging into the machine with: \'ssh admin@10.0.0.5\'',
  'ssh-keygen -l -f key.pub': '$ ssh-keygen -l -f ~/.ssh/id_ed25519.pub\n256 SHA256:AAAA...BBBB user@hostname (ED25519)',
  'ssh-keygen -R hostname': '$ ssh-keygen -R 192.168.1.5\n# Host 192.168.1.5 found: line 14\n/home/user/.ssh/known_hosts updated.\n# removes stale host key (needed after OS reinstall)',
  'ssh -J jump user@target': '$ ssh -J admin@jump.corp.com user@internal-server.corp.com\n# connects to internal-server via jump host',
  'ssh -D 1080 user@host': '$ ssh -D 1080 -N -f admin@remote-host\n# creates SOCKS5 proxy on localhost:1080 through remote-host',
  'ssh -L 8080:internal:80 user@host': '$ ssh -L 8080:internal-web:80 admin@bastion\n# forwards localhost:8080 to internal-web:80 via bastion',
  'ssh -R 2222:localhost:22 user@host': '$ ssh -R 2222:localhost:22 admin@remote-host\n# exposes local SSH port 22 as port 2222 on remote-host',

  // ── Linux Ref 22. Kernel & Module Management ───────────────────────────
  'modprobe module': '$ modprobe ip_tables\n$ lsmod | grep ip_tables\nip_tables              32768  3 iptable_filter,iptable_mangle,iptable_nat',
  'modprobe -r module': '$ modprobe -r ip_tables\n# removes module and its dependencies if no longer needed',
  'modinfo module': '$ modinfo ip_tables\nfilename:       /lib/modules/5.15.0-91-generic/kernel/net/ipv4/netfilter/ip_tables.ko\ndescription:    IPv4 packet filter\nauthor:         Netfilter Core Team\nlicense:        GPL\nretpoline:      Y',
  'modinfo -F filename module': '$ modinfo -F filename ip_tables\n/lib/modules/5.15.0-91-generic/kernel/net/ipv4/netfilter/ip_tables.ko',
  'uname -m': '$ uname -m\nx86_64',
  'uname -r': '$ uname -r\n5.15.0-91-generic',
  'lsmod': '$ lsmod | head -8\nModule                  Size  Used by\nnf_conntrack_netlink    49152  0\nnfnetlink               20480  2 nf_conntrack_netlink,ip_tables\nip_tables               32768  3',
  'cat /proc/modules': '$ cat /proc/modules | head -3\nip_tables 32768 3 iptable_filter,iptable_mangle,iptable_nat, Live 0xffffffffc0a10000\nnf_conntrack 188416 4 nf_nat,xt_conntrack,nf_conntrack_netlink,ip_tables, Live 0xffffffffc09b0000',
  'depmod -a': '$ depmod -a\n# updates modules.dep and related map files for current kernel',
  'echo "module-name" >> /etc/modules': '$ echo "ip_tables" | sudo tee -a /etc/modules\nip_tables\n# loads ip_tables module automatically on boot',
  'sysctl -a': '$ sysctl -a | grep net.ipv4.ip_forward\nnet.ipv4.ip_forward = 1',

  // ── Linux Ref 23. Docker & Containers ──────────────────────────────────
  'docker ps': '$ docker ps\nCONTAINER ID  IMAGE        COMMAND              CREATED        STATUS         PORTS               NAMES\na1b2c3d4e5f6  nginx:latest "/docker-entrypoint…" 2 hours ago    Up 2 hours     0.0.0.0:80->80/tcp  web-nginx',
  'docker ps -a': '$ docker ps -a\nCONTAINER ID  IMAGE        COMMAND   CREATED     STATUS                   NAMES\na1b2c3d4e5f6  nginx:latest "nginx"   2 hours ago Up 2 hours               web-nginx\nb6c5d4e3f2a1  ubuntu:22.04 "bash"    1 day ago   Exited (0) 23 hours ago  test-ubuntu',
  'docker run -d image': '$ docker run -d -p 80:80 --name web-nginx nginx:latest\na1b2c3d4e5f6789012345678901234567890abcdef0123456789012345678901234\n# starts nginx container in background and returns container ID',
  'docker exec -it container bash': '$ docker exec -it web-nginx bash\nroot@a1b2c3d4e5f6:/# nginx -v\nnginx version: nginx/1.25.3\nroot@a1b2c3d4e5f6:/# exit',
  'docker inspect container': '$ docker inspect web-nginx | python3 -m json.tool | grep -A3 "IPAddress"\n            "IPAddress": "172.17.0.2",\n            "IPPrefixLen": 16,\n            "IPv6Gateway": "",',
  'docker logs container': '$ docker logs web-nginx --tail 20\n2026/06/21 08:00:01 [notice] 1#1: nginx/1.25.3 started\n10.0.0.1 - - [21/Jun/2026:08:05:12 +0000] "GET / HTTP/1.1" 200 615',
  'docker stop container': '$ docker stop web-nginx\nweb-nginx\n# sends SIGTERM; waits 10s then SIGKILL',
  'docker rm container': '$ docker rm web-nginx\nweb-nginx\n# removes stopped container',
  'docker rmi image': '$ docker rmi nginx:latest\nUntagged: nginx:latest\nDeleted: sha256:abc123...\n# removes image (must have no running containers using it)',
  'docker build -t name .': '$ docker build -t myapp:v1.0 .\n[+] Building 12.5s (8/8) FINISHED\n => [1/4] FROM docker.io/library/node:18      3.5s\n => [2/4] COPY package.json .                0.1s\n => [3/4] RUN npm install                   8.5s\n => [4/4] COPY . .                          0.1s',

  // ── Linux Ref 24. Security & Auditing ──────────────────────────────────
  'auditctl -l': '$ auditctl -l\n-w /etc/passwd -p wa -k passwd_changes\n-w /etc/shadow -p wa -k shadow_changes\n-a always,exit -F arch=b64 -S open -k file_opens',
  'auditctl -w /etc/passwd -p wa': '$ auditctl -w /etc/passwd -p wa -k passwd_monitor\n# watches /etc/passwd for writes and attribute changes',
  'auditctl -w /etc/shadow -p wa': '$ auditctl -w /etc/shadow -p wa -k shadow_monitor\n# watches /etc/shadow for writes and attribute changes',
  'rkhunter --update': '$ sudo rkhunter --update\n[ Rootkit Hunter version 1.4.6 ]\nChecking rkhunter data files...\n  Checking file mirrors                            [ Updated ]\n  Checking program updates                         [ No update ]',
  'aa-status': '$ aa-status\napparmor module is loaded.\n34 profiles are loaded.\n33 profiles are in enforce mode.\n1 profiles are in complain mode.',
  'aureport --auth': '$ aureport --auth --summary\nAuthentication Report Summary\n=========================\nrange of time in logs: 06/14/2026 - 06/21/2026\nNumber of authentication events: 352\nNumber of failed authentications: 12',
  'chkrootkit': '$ sudo chkrootkit\nCHECKING `bindshell\'... not infected\nCHECKING `lkm\'... chkproc: nothing detected\nCHECKING `rexedcs\'... not found\nCHECKING `sniffer\'... eth0: not promisc and no packet sniffer sockets',

  // ── Linux Ref 25. Cryptography & Hashing ───────────────────────────────
  'sha256sum file': '$ sha256sum /opt/ubuntu-22.04.iso\na8c2f6171c82e45de7b3e8f6c1562...\n/opt/ubuntu-22.04.iso',
  'sha512sum file': '$ sha512sum config-backup.tar.gz\n3b4a5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f...\nconfig-backup.tar.gz',
  'md5sum file': '$ md5sum firmware.bin\nd41d8cd98f00b204e9800998ecf8427e  firmware.bin',
  'sha1sum file': '$ sha1sum package.deb\nda39a3ee5e6b4b0d3255bfef95601890afd80709  package.deb',
  'cksum file': '$ cksum /etc/hosts\n2850756552 221 /etc/hosts\n# CRC checksum, size, and filename',
  'openssl rand -hex 32': '$ openssl rand -hex 32\na3f8c2e1d4b7f09a2c5e8b3d6f0a1c4e7b0d3f6a9c2e5b8d1f4a7c0e3b6d9f2',
  'openssl rand -base64 24': '$ openssl rand -base64 24\nKj8mNpL2xRvQs9wYz4hBcA==\n# generates 24 random bytes encoded as base64',
  'gpg --gen-key': '$ gpg --gen-key\nNote: Use "gpg --full-generate-key" for a full featured key generation dialog.\nGnuPG needs to construct a user ID to identify your key.\nReal name: Alice Smith\nEmail address: alice@example.com\npub   ed25519 2026-06-21 [SC] [expires: 2028-06-20]',
  'gpg --encrypt -r recipient file': '$ gpg --encrypt -r alice@example.com sensitive.tar.gz\n# creates sensitive.tar.gz.gpg encrypted to alice\'s public key',
  'gpg --decrypt file.gpg': '$ gpg --decrypt sensitive.tar.gz.gpg > sensitive.tar.gz\ngpg: encrypted with 256-bit ECDH key, ID ABCD1234\ngpg: decryption okay',

  // ── Linux Ref 26. Git & Version Control ────────────────────────────────
  'git clone url': '$ git clone https://github.com/org/repo.git\nCloning into \'repo\'...\nremote: Counting objects: 1234, done.\nReceiving objects: 100% (1234/1234), 5.67 MiB | 3.21 MiB/s, done.',
  'git diff': '$ git diff\ndiff --git a/config.py b/config.py\nindex abc1234..def5678 100644\n--- a/config.py\n+++ b/config.py\n@@ -12,7 +12,7 @@\n-DEBUG = True\n+DEBUG = False',
  'git diff --staged': '$ git diff --staged\n# shows diff of staged changes vs last commit',
  'git stash pop': '$ git stash pop\nOn branch feature/login\nChanges not staged for commit:\n  modified:   auth/views.py\nDropped refs/stash@{0} (sha1abc123)',
  'git rebase main': '$ git rebase main\nSuccessfully rebased and updated refs/heads/feature/auth.\n# replays your commits on top of current main',
  'git log --oneline --graph': '$ git log --oneline --graph -10\n* a1b2c3d (HEAD -> main) fix: resolve auth timeout\n* e4f5a6b feat: add LDAP integration\n* c7d8e9f docs: update API reference\n| * 1a2b3c4 (origin/feature/auth) wip: OAuth flow',
  'git cherry-pick <sha>': '$ git cherry-pick a1b2c3d\n[main 9f8e7d6] fix: resolve auth timeout\n Date: Sat Jun 21 09:00:00 2026 +0000\n 1 file changed, 3 insertions(+), 1 deletion(-)',
  'git bisect start': '$ git bisect start\n$ git bisect bad HEAD\n$ git bisect good v1.5.0\nBisecting: 64 revisions left to test after this (roughly 6 steps)',
  'git tag -a v1.0.0 -m "message"': '$ git tag -a v1.0.0 -m "Release 1.0.0"\n$ git push origin v1.0.0\nTo github.com:org/repo.git\n * [new tag]         v1.0.0 -> v1.0.0',

  // ── Linux Ref 27. Database Commands ────────────────────────────────────
  'mysql -u root -p': '$ mysql -u root -p\nEnter password:\nWelcome to the MySQL monitor. Commands end with ; or \\g.\nYour MySQL connection id is 8\nmysql>',
  'mysql db < backup.sql': '$ mysql -u root -p mydb < backup-2026-06-21.sql\nEnter password:\n# imports SQL dump into mydb',
  'sudo -u postgres psql': '$ sudo -u postgres psql\npsql (14.11 (Ubuntu 14.11-0ubuntu0.22.04.1))\nType "help" for help.\npostgres=#',
  '\\l': 'postgres=# \\l\n                                  List of databases\n   Name    |  Owner   | Encoding |   Collate   |    Ctype    |\n-----------+----------+----------+-------------+-------------+\n mydb      | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |',
  '\\dt': 'mydb=# \\dt\n         List of relations\n Schema |   Name   | Type  |  Owner\n--------+----------+-------+----------\n public | users    | table | postgres\n public | sessions | table | postgres',
  'mysqldump -u root -p db > backup.sql': '$ mysqldump -u root -p mydb > mydb-backup-2026-06-21.sql\nEnter password:\n$ ls -lh mydb-backup-2026-06-21.sql\n-rw-r--r-- 1 root root 45M Jun 21 mydb-backup-2026-06-21.sql',
  'pg_dump dbname > backup.sql': '$ pg_dump -U postgres mydb > mydb-backup.sql\n$ ls -lh mydb-backup.sql\n-rw-r--r-- 1 postgres postgres 23M Jun 21 mydb-backup.sql',
  'psql -U postgres -c "SELECT version();"': '$ psql -U postgres -c "SELECT version();"\n                            version\n----------------------------------------------------------------\n PostgreSQL 14.11 on x86_64-pc-linux-gnu, compiled by gcc 11.4.0',
  'redis-cli ping': '$ redis-cli ping\nPONG\n$ redis-cli info server | head -5\n# Server\nredis_version:7.0.12\nredis_mode:standalone\nos:Linux 5.15.0-91-generic x86_64',
  'redis-cli monitor': '$ redis-cli monitor\nOK\n1718956800.123456 [0 127.0.0.1:45123] "SET" "session:user:42" "token123"\n1718956800.456789 [0 127.0.0.1:45123] "GET" "session:user:42"',

  // ── Linux Ref 28. Virtualization ───────────────────────────────────────
  'virsh list': '$ virsh list\n Id    Name        State\n----------------------------------------------------\n 1     ubuntu22    running\n 2     debian12    running',
  'virsh list --all': '$ virsh list --all\n Id    Name        State\n----------------------------------------------------\n 1     ubuntu22    running\n -     win2022     shut off\n -     centos8     paused',
  'virsh start vm': '$ virsh start ubuntu22\nDomain ubuntu22 started',
  'virsh shutdown vm': '$ virsh shutdown ubuntu22\nDomain ubuntu22 is being shutdown\n# graceful shutdown via ACPI signal',
  'virsh destroy vm': '$ virsh destroy ubuntu22\nDomain ubuntu22 destroyed\n# immediate power-off (like pulling the plug)',
  'virsh snapshot-create-as vm snap1': '$ virsh snapshot-create-as ubuntu22 snap-2026-06-21 "Pre-update"\nDomain snapshot snap-2026-06-21 created',
  'virsh dominfo vm': '$ virsh dominfo ubuntu22\nId:             1\nName:           ubuntu22\nState:          running\nCPU(s):         4\nMax memory:     8388608 KiB\nUsed memory:    7340032 KiB',
  'virt-clone --original vm --name new --auto-clone': '$ virt-clone --original ubuntu22 --name ubuntu22-clone --auto-clone\nAllocating \'ubuntu22-clone.qcow2\'  |  20 GB  00:01:23\nClone \'ubuntu22-clone\' created successfully.',
  'virt-install --name vm --ram 2048 --disk size=20': '$ virt-install --name new-vm --ram 2048 --disk size=20 --cdrom ubuntu-22.04.iso --os-variant ubuntu22.04\nStarting install...\nAllocating \'new-vm.qcow2\'  |  20 GB  00:00:08',
  'qemu-img info disk.qcow2': '$ qemu-img info ubuntu22.qcow2\nimage: ubuntu22.qcow2\nfile format: qcow2\nvirtual size: 50 GiB (53687091200 bytes)\ndisk size: 12.3 GiB\ncluster_size: 65536',
  'brctl show': '$ brctl show\nbridge name  bridge id          STP enabled  interfaces\nvirbr0       8000.525400a1b2c3  yes          virbr0-nic\n                                              vnet0',

  // ── Linux Ref 29. System Benchmarking & Diagnostics ────────────────────
  'sysbench cpu run': '$ sysbench cpu --cpu-max-prime=20000 run\nCPU speed:\n    events per second: 1245.67\nGeneral statistics:\n    total time:         10.0008s\n    total number of events: 12456',
  'sysbench fileio prepare': '$ sysbench fileio --file-total-size=2G prepare\nsysbench 1.0.20\nCreating files for the test\nExtra file open flags: (none)\n128 files, 16MiB each; 2GiB total',
  'sysbench fileio run': '$ sysbench fileio --file-total-size=2G --file-test-mode=rndrw run\nFile operations:\n    reads/s:             876.32\n    writes/s:            584.21\n    fsyncs/s:            14.54\nThroughput:\n    read, MiB/s:         13.69\n    written, MiB/s:       9.13',
  'fio --name=test --size=1G --rw=readwrite': '$ fio --name=randread --size=1G --rw=randread --bs=4k --ioengine=libaio --iodepth=32\nrandread: (groupid=0, jobs=1): err= 0: pid=12345\n  READ: bw=450MiB/s (472MB/s), 450MiB/s-450MiB/s\n  IOPS=115203, run=2274-2274msec',
  'stress --cpu 4': '$ stress --cpu 4 --timeout 30\nstress: info: [12345] dispatching hogs: 4 cpu, 0 io, 0 vm, 0 hdd\nstress: info: [12345] successful run completed in 30s',
  'iperf3 -s': '$ iperf3 -s\n-----------------------------------------------------------\nServer listening on 5201\n-----------------------------------------------------------\nAccepted connection from 192.168.1.5, port 54321\n[  5] local 192.168.1.1 port 5201 connected to 192.168.1.5 port 54321\n[ ID] Interval       Transfer     Bitrate\n[  5]  0.00-10.00  sec  1.09 GBytes   939 Mbits/sec   receiver',
  'iperf3 -c host': '$ iperf3 -c 192.168.1.1\nConnecting to host 192.168.1.1, port 5201\n[ ID] Interval       Transfer     Bitrate\n[  5]  0.00-10.00  sec  1.09 GBytes   937 Mbits/sec   sender\n[  5]  0.00-10.00  sec  1.09 GBytes   939 Mbits/sec   receiver',
  'hdparm -Tt /dev/sda': '$ hdparm -Tt /dev/sda\n/dev/sda:\n Timing cached reads:    12345 MB in  2.00 seconds = 6172.50 MB/sec\n Timing buffered disk reads: 1234 MB in  3.00 seconds =  411.33 MB/sec',
  'lshw -short': '$ lshw -short\nH/W path     Device      Class      Description\n=============================================\n                         system     ProLiant DL380 Gen10\n/0                       bus        System Board\n/0/0                     memory     64GiB System Memory\n/0/1                     processor  Intel Xeon Gold 6230R',

  // ── Linux Ref 30. Bash Scripting Essentials ─────────────────────────────
  '#!/usr/bin/env bash': '#!/usr/bin/env bash\n# Preferred shebang: finds bash in PATH regardless of location\n# vs #!/bin/bash which requires bash at /bin/bash',
  'set -u': '#!/usr/bin/env bash\nset -u\n# Treat unset variables as errors:\n# $ MYVAR=""\n# $ echo $TYPO   → error: TYPO: unbound variable',
  'set -x': '#!/usr/bin/env bash\nset -x\n# Print each command before executing:\n# + echo hello\n# hello\n# + rm /tmp/test.txt',
  'set -o pipefail': '#!/usr/bin/env bash\nset -o pipefail\n# Pipe fails if ANY command in the pipe fails:\n# grep "error" app.log | sort | uniq  → exits non-zero if grep finds nothing',
  'set -euo pipefail': '#!/usr/bin/env bash\nset -euo pipefail\n# Combined: exit on error (-e), undefined vars (-u), pipefail\n# Standard safe header for production scripts',
  'trap "rm -f $TMP" EXIT': "#!/usr/bin/env bash\nset -euo pipefail\nTMP=$(mktemp)\ntrap \"rm -f \\$TMP\" EXIT\n# Cleanup temp file on exit, error, or Ctrl-C",
  '[[ -f file ]]': 'if [[ -f /etc/nginx/nginx.conf ]]; then\n    echo "nginx config found"\nfi\n# -f: regular file; -d: directory; -z: empty string; -n: non-empty',
  'for i in "${array[@]}"': 'servers=("web1" "web2" "db1")\nfor server in "${servers[@]}"; do\n    echo "Pinging $server"\n    ping -c1 "$server" &>/dev/null && echo "UP" || echo "DOWN"\ndone',
  'while read -r line': 'while IFS= read -r line; do\n    echo "Processing: $line"\ndone < /etc/hosts\n# IFS= preserves leading whitespace; -r prevents backslash escape',
  'function name() { }': 'function check_service() {\n    local svc="$1"\n    systemctl is-active --quiet "$svc" && echo "$svc: running" || echo "$svc: stopped"\n}\n\ncheck_service nginx\ncheck_service sshd',
  'readonly VAR=value': 'readonly CONFIG_DIR="/etc/myapp"\nreadonly MAX_RETRIES=5\n# prevents accidental reassignment later in script',
  'local var=value': 'function get_hostname() {\n    local host="$1"\n    local result\n    result=$(dig +short "$host")\n    echo "$result"\n}\n# local keeps variable scoped to function',

  // ── NetScaler SDX ───────────────────────────────────────────────────────
  'show system config': '> show system config\nSystem Configuration:\n  Hostname: SDX-1\n  NTP Server: 10.0.0.1\n  DNS Server: 8.8.8.8\n  Time Zone: GMT+0\n  SNMP Community: public\n  Syslog Server: 10.0.0.5:514',
  'show system storage': '> show system storage\nStorage:\n  Total:  500 GB\n  Used:   120 GB\n  Free:   380 GB\n  Usage:  24%',
  'show system alarms': '> show system alarms\nAlarms:\n  1) Severity: WARNING  Component: CPU  Message: CPU usage > 80%  Time: 09:01:15',
  'show chassis backplane': '> show chassis backplane\nBackplane Status:\n  Fabric:   Active\n  Speed:    10Gbps\n  State:    UP',
  'show chassis backplane -detail': '> show chassis backplane -detail\nBackplane Detailed Status:\n  Fabric Link 0: UP  10Gbps\n  Fabric Link 1: UP  10Gbps\n  Errors: 0\n  Drops: 0',
  'show chassis network -detail': '> show chassis network -detail\nChassis Network Detailed:\n  Management Port: 1G UP\n  Data Ports:     10G UP (2)\n  Backplane:      Active',
  'show backplane': '> show backplane\nBackplane: Active\nSpeed: 10Gbps\nState: UP',
  'show backplane interfaces': '> show backplane interfaces\nInterface  Speed   State\n---------  ------  -----\nbp0/1      10Gbps  UP\nbp0/2      10Gbps  UP',
  'show backplane interfaces -detail': '> show backplane interfaces -detail\nInterface bp0/1:\n  Speed: 10Gbps  Duplex: Full  State: UP\n  RX bytes: 1234567890  TX bytes: 987654321\n  Errors: 0  Drops: 0',
  'show sslchip': '> show sslchip\nSSL Chips:\n  Chip 0: Present  Status: Active\n  Chip 1: Present  Status: Active\n  Total chips: 2',
  'show sslchip -detail': '> show sslchip -detail\nSSL Chip 0:\n  Status: Active\n  Sessions: 1024\n  TPS: 512\n  Firmware: 2.3.4\nSSL Chip 1:\n  Status: Active\n  Sessions: 956\n  TPS: 487',
  'show sslchip stats': '> show sslchip stats\nSSL Chip Statistics:\n  Chip 0: RSA ops/s: 1024  ECC ops/s: 512  TLS sessions: 2048\n  Chip 1: RSA ops/s: 987   ECC ops/s: 498  TLS sessions: 1987',
  'show cpu': '> show cpu\nCPU Usage:\n  CPU 0: 25%\n  CPU 1: 32%\n  Average: 28%',
  'show cpu -detail': '> show cpu -detail\nCPU 0: User: 18%  System: 7%  Idle: 75%\nCPU 1: User: 22%  System: 10% Idle: 68%\nLoad Average: 0.45 (1m)  0.52 (5m)  0.38 (15m)',
  'show cpu cores': '> show cpu cores\nCPU Cores:\n  Core 0: 23%  Core 1: 31%  Core 2: 19%  Core 3: 28%\n  Physical CPUs: 2  Total Cores: 8  Threads: 16',
  'show memory': '> show memory\nMemory:\n  Total:     32768 MB\n  Used:      12288 MB\n  Free:      20480 MB\n  Cached:     4096 MB',
  'show memory -detail': '> show memory -detail\nMemory Detail:\n  Total Physical:   32768 MB\n  Kernel Used:        512 MB\n  Management Plane: 8192 MB\n  VPX Allocated:    3584 MB\n  Free:            20480 MB',
  'show memory allocation': '> show memory allocation\nMemory Allocation:\n  SDX Management:  512 MB\n  VPX-1:          2048 MB\n  VPX-2:          2048 MB\n  VPX-3:          1024 MB\n  Unallocated:   27136 MB',
  'show vpx status -detail': '> show vpx status -detail\nVPX-1 (vpx-prod-01):\n  State:    Running\n  CPU:      2 vCPUs\n  Memory:   4096 MB\n  Disk:     50 GB\n  NSIP:     10.10.10.10/24\n  Version:  NS13.1 Build 42.47\n  Uptime:   5d 2h 13m',
  'show vpx resources -detail': '> show vpx resources -detail\nVPX-1 Resource Usage:\n  CPU:     28%\n  Memory:  61%  (2500 MB / 4096 MB)\n  Disk:    45%  (22.5 GB / 50 GB)\n  TX/RX:   120 Mbps / 345 Mbps',
  'show vpx cpu': '> show vpx cpu\nVPX CPU Usage:\n  VPX-1: 28%\n  VPX-2: 15%\n  VPX-3: 42%',
  'xe host-list': '$ xe host-list\nuuid ( RO)           : a1b2c3d4-e5f6-7890-abcd-ef1234567890\n          name-label ( RW): SDX-XenServer\n    name-description ( RW): Default install of XenServer\n              enabled ( RO): true',
  'xe vm-list': '$ xe vm-list\nuuid ( RO)           : 11111111-2222-3333-4444-555555555555\n          name-label ( RW): VPX-1\n         power-state ( RO): running',
  'xe vm-list params=all': '$ xe vm-list params=all uuid=11111111-2222-3333-4444-555555555555\nuuid ( RO)              : 11111111-2222-3333-4444-555555555555\n  name-label ( RW)      : VPX-1\n  memory-static-max     : 4294967296\n  VCPUs-number ( RO)    : 2\n  power-state ( RO)     : running',
  'xe vm-start uuid=<uuid>': '$ xe vm-start uuid=11111111-2222-3333-4444-555555555555\n# starts the specified VM',
  'xe vm-shutdown uuid=<uuid>': '$ xe vm-shutdown uuid=11111111-2222-3333-4444-555555555555\n# gracefully shuts down the VM via ACPI',
  'xe vm-reboot uuid=<uuid>': '$ xe vm-reboot uuid=11111111-2222-3333-4444-555555555555\n# gracefully reboots the VM',
  'xe vm-reset uuid=<uuid>': '$ xe vm-reset-powerstate uuid=11111111-2222-3333-4444-555555555555 --force\n# hard resets VM power state (use when VM is unresponsive)',
  'xe vm-snapshot uuid=<uuid> new-name-label=<name>': '$ xe vm-snapshot uuid=11111111-2222-3333-4444-555555555555 new-name-label=snap-2026-06-21\nuuid ( RO)  : aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n# snapshot UUID returned on success',
  'xe vm-disk-list uuid=<uuid>': '$ xe vm-disk-list uuid=11111111-2222-3333-4444-555555555555\nuuid ( RO)         : dddddddd-eeee-ffff-0000-111111111111\n        name-label : VPX-1 root\n  virtual-size     : 53687091200 (50 GiB)',
  'xe vm-disk-add uuid=<uuid> disk-size=<size>': '$ xe vm-disk-add uuid=11111111-2222-3333-4444-555555555555 disk-size=53687091200 sr-uuid=ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb\n# adds a 50GB virtual disk to the VM',
  'xl list': '$ xl list\nName                                        ID   Mem VCPUs State   Time(s)\nDomain-0                                     0 16384     8     r-----  3456.7\nVPX-1                                        1  4096     2     r-----   789.2\nVPX-2                                        2  4096     2     r-----   456.1',
  'xl top': '$ xl top\nxentop - 09:30:01 Xen 4.14.0\nHosts: 1 Domains: 4  Flags: X=paused, D=dead, H=cpu-blocked\n  ID  NAME       STATE  CPU(sec)  CPU(%)  MEM(k) MEM(%)\n   0  Domain-0    -----      3456     2.1  16777216   50.0\n   1  VPX-1       -----       789    12.4   4194304   12.5',
  'xl dmesg': '$ xl dmesg | tail -10\nXen 4.14.0 booted successfully\n(XEN) CPU 0 booted\n(XEN) VT-x enabled\n(XEN) Memory: 65536MB\n(XEN) Domain-0: 16384MB allocated',
  'ovs-vsctl show': '$ ovs-vsctl show\n12345678-abcd-ef01-2345-6789abcdef01\n    Bridge "ovsbr0"\n        Port "eth2"\n            Interface "eth2"\n        Port "ovsbr0"\n            Interface "ovsbr0"\n                type: internal',
  'ovs-vsctl list-br': '$ ovs-vsctl list-br\novsbr0\novsbr1',
  'ovs-vsctl list-ports <bridge>': '$ ovs-vsctl list-ports ovsbr0\neth2\nvif1.0\nvif2.0\n# lists all ports attached to bridge ovsbr0',
  'show storage': '> show storage\nStorage Summary:\n  Total:    500 GB\n  Used:     120 GB\n  Free:     380 GB\n  Disks:    2 (RAID1)',
  'show storage disks': '> show storage disks\nDisk  Size   State   Health\n----  -----  ------  ------\nsda   500GB  Active  Good\nsdb   500GB  Active  Good',
  'show storage disks -detail': '> show storage disks -detail\nDisk: sda\n  Vendor:  SEAGATE\n  Model:   ST500NX0X3\n  Serial:  ZA1234AB\n  Size:    500 GB\n  State:   Active\n  Smart:   OK\n  Temp:    38°C',
  'xentop -b': '$ xentop -b -i1\nxentop - 09:35:00 Xen 4.14.0\n  ID  NAME     STATE  CPU(sec)  CPU(%)  MEM(k)\n   0  Domain-0  -----     3460     2.1  16777216\n   1  VPX-1     -----      792    12.6   4194304\n# batch mode: single snapshot output (scriptable)',
  'xentop -f': '$ xentop -f -i1\n# full mode: shows all fields including network and disk stats',
  'xentop -i 1': '$ xentop -i 1\n# single iteration then exit; useful in scripts',
  'show logs': '> show logs\nLog Summary:\n  Size: 125 MB  Entries: 45,231  Oldest: 2026-06-01',
  'show logs -detail': '> show logs -detail\nLog Files:\n  management.log  45 MB  Last: 09:35:12\n  error.log       12 MB  Last: 09:30:01\n  audit.log       68 MB  Last: 09:35:10',
  'show logs messages': '> show logs messages\nJun 21 09:35:10 SDX-1 mgmtd[1234]: VPX-1 state changed to Running\nJun 21 09:30:01 SDX-1 kernel: eth0: NIC link is Up\nJun 21 09:25:44 SDX-1 mgmtd[1234]: Backup completed successfully',
  'show ha status -detail': '> show ha status -detail\nHA Status: ENABLED\nLocal Node:\n  Node ID:    1\n  IP:         10.10.10.10\n  State:      PRIMARY\n  Uptime:     5d 2h 13m\nPeer Node:\n  Node ID:    2\n  IP:         10.10.10.11\n  State:      SECONDARY\n  Heartbeat:  OK (last: 0.3s ago)',
  'show ha nodes': '> show ha nodes\nNode  IP             State      Role       Uptime\n----  -------------  ---------  ---------  ------\n1     10.10.10.10    ENABLED    PRIMARY    5d 2h\n2     10.10.10.11    ENABLED    SECONDARY  5d 2h',
  'show ha nodes -detail': '> show ha nodes -detail\nNode 1 (PRIMARY):\n  IP:          10.10.10.10\n  Heartbeat:   OK\n  Sync State:  COMPLETE\n  Last Sync:   09:35:00\n  VPX Count:   5',
  'show cluster': '> show cluster\nCluster Status: ENABLED\nNodes: 3 (Active: 3)\nBackplane: OK\nVersion: 13.1 Build 42',
  'show cluster nodes': '> show cluster nodes\nNode  IP            State    Role      Uptime\n----  -----------  -------  --------  ------\n0     10.10.10.10  ACTIVE   CLUSTER   5d\n1     10.10.10.11  ACTIVE   CLUSTER   5d\n2     10.10.10.12  ACTIVE   CLUSTER   4d',
  'show cluster nodes -detail': '> show cluster nodes -detail\nNode 0 (10.10.10.10):\n  State: ACTIVE\n  Backplane: 10.254.0.10 (UP)\n  VPX Count: 4\n  CPU: 23%  Memory: 45%',
  'show security': '> show security\nSecurity Configuration:\n  SSH:      Enabled (port 22)\n  HTTPS:    Enabled (port 443)\n  HTTP:     Disabled\n  Telnet:   Disabled\n  SCP:      Enabled',
  'show security policies': '> show security policies\nSecurity Policies:\n  Admin Network: 10.0.0.0/24 ALLOW\n  Management:    192.168.1.0/24 ALLOW\n  Default:       DENY',
  'show security policies -detail': '> show security policies -detail\nPolicy: Admin Network\n  Source: 10.0.0.0/24\n  Action: ALLOW\n  Ports:  22,443\n  Active: Yes\nPolicy: Management\n  Source: 192.168.1.0/24\n  Action: ALLOW\n  Ports:  443\n  Active: Yes',
  'show firmware': '> show firmware\nFirmware:\n  Current Version:  13.1.0-42.47\n  Build Date:       2024-01-12\n  Platform:         SDX-22000',
  'show firmware version': '> show firmware version\nVersion Information:\n  SDX Firmware:   13.1.0-42.47\n  XenServer:      8.2.1\n  Xen Hypervisor: 4.14.0\n  Build:          Jan 12 2024',
  'show firmware images': '> show firmware images\nAvailable Firmware Images:\n  1) 13.1.0-42.47 (current, active)\n  2) 13.0.0-84.11 (backup)',
  'show backup': '> show backup\nBackup Summary:\n  Latest: backup-2026-06-20.tgz (125 MB)\n  Count:  7 backups stored\n  Schedule: Daily at 02:00',
  'show backup files': '> show backup files\nBackup Files:\n  backup-2026-06-21.tgz  125 MB  2026-06-21 02:00\n  backup-2026-06-20.tgz  124 MB  2026-06-20 02:00\n  backup-2026-06-19.tgz  123 MB  2026-06-19 02:00',
  'show backup files -detail': '> show backup files -detail\nFile: backup-2026-06-21.tgz\n  Size:     125 MB\n  Created:  2026-06-21 02:00:14\n  Contains: System config, VPX configs, Certificates\n  Checksum: sha256:abc123...',
  'show network': '> show network\nNetwork Summary:\n  Management IP:  10.10.10.10/24\n  Gateway:        10.10.10.1\n  DNS:            8.8.8.8, 8.8.4.4\n  Hostname:       sdx-01.corp.com',
  'show network interfaces': '> show network interfaces\nInterface  IP/Prefix        State  Speed\n---------  ---------------  -----  -----\n0/1        10.10.10.10/24   UP     1G\n0/2        10.20.20.10/24   UP     10G',
  'show network interfaces -detail': '> show network interfaces -detail\nInterface 0/1:\n  IP:       10.10.10.10/24\n  Gateway:  10.10.10.1\n  MAC:      00:e0:ed:ab:cd:ef\n  Speed:    1Gbps Full\n  State:    UP\n  MTU:      1500',
  'show service': '> show service\nService Status:\n  mgmtd:    Running  (PID 1234)\n  httpd:    Running  (PID 2345)\n  sshd:     Running  (PID 3456)\n  xenagent: Running  (PID 4567)',
  'show service status': '> show service status\nService     State    PID    Uptime\n-------     -----    ---    ------\nmgmtd       Running  1234   5d 2h\nhttpd       Running  2345   5d 2h\nsshd        Running  3456   5d 2h',
  'show service status -detail': '> show service status -detail\nService: mgmtd\n  State:    Running\n  PID:      1234\n  Uptime:   5d 2h 13m\n  CPU:      2.1%\n  Memory:   512 MB\n  Restarts: 0',
  'show monitor': '> show monitor\nMonitor Status: Enabled\n  SNMP:    Enabled (v2c)\n  Syslog:  Enabled → 10.0.0.5:514\n  Netflow: Disabled',
  'show monitor metrics': '> show monitor metrics\nCurrent Metrics:\n  CPU:       28%\n  Memory:    45%\n  Disk:      24%\n  Network:   120 Mbps IN / 345 Mbps OUT\n  SSL TPS:   999',
  'show monitor metrics -detail': '> show monitor metrics -detail\nMetrics Detail (last 60s):\n  CPU:     avg=28% peak=45% min=12%\n  Memory:  avg=45% peak=47% min=44%\n  Net IN:  avg=120 Mbps peak=450 Mbps\n  Net OUT: avg=345 Mbps peak=890 Mbps',
  'show telemetry': '> show telemetry\nTelemetry: Enabled\n  Endpoint: telemetry.citrix.com\n  Protocol: HTTPS\n  Interval: 300s',
  'show telemetry status': '> show telemetry status\nTelemetry Status:\n  State:       Active\n  Last Upload: 2026-06-21 09:00:00\n  Records Sent: 1,234',
  'show telemetry metrics': '> show telemetry metrics\nTelemetry Metrics Collected:\n  CPU utilization, Memory utilization\n  Session counts, SSL TPS\n  VPX health, Error rates',
  'show analytics': '> show analytics\nAnalytics Status: Enabled\n  Mode: Streaming\n  Endpoint: 10.0.0.10:5557\n  Schema: Insight Center',
  'show analytics cpu': '> show analytics cpu\nCPU Analytics (last 5min):\n  Avg: 28%   Peak: 45%   Min: 12%\n  Trend: Stable',
  'show analytics memory': '> show analytics memory\nMemory Analytics (last 5min):\n  Avg: 45%   Peak: 47%   Min: 44%\n  Free: 20480 MB   Used: 12288 MB',
  'show logging': '> show logging\nLogging Configuration:\n  Local:   Enabled (level: ERROR)\n  Syslog:  10.0.0.5:514 (level: INFO)\n  SNMP Traps: 10.0.0.6',
  'show logging status': '> show logging status\nLogging Status:\n  Local log:   Active   (125 MB used)\n  Syslog:      Connected to 10.0.0.5:514\n  Last entry:  09:35:10 (mgmtd: VPX state changed)',
  'show logging files': '> show logging files\nLog Files:\n  /var/log/management.log  45 MB  Modified: 09:35:10\n  /var/log/error.log       12 MB  Modified: 09:30:01\n  /var/log/audit.log       68 MB  Modified: 09:35:10',
};

// ─── 10 NEW COMMANDS TO INSERT ────────────────────────────────────────────
const NEW_COMMANDS = [
  {
    platform: 'nexus',
    section: 'System & Status',
    entry: {
      cmd: 'show module internal exception-log',
      desc: 'Displays the module internal exception log — catches software faults, assertion failures, and watchdog events that normal show commands may not surface',
      type: 'show',
      flagged: false,
      example: 'switch# show module internal exception-log\nException log for module 1:\n  [1] Time: Jun 21 08:12:34 2026  PID: 12345  Signal: SIGSEGV\n      Process: netstack  Thread: main\n      Reason: Segmentation fault in rib_update()\n  No further exceptions in the last 24h.'
    }
  },
  {
    platform: 'aruba_cx',
    section: 'L3 Routing',
    entry: {
      cmd: 'show ip ospf neighbors',
      desc: 'Displays all OSPF neighbor relationships — neighbor ID, priority, state (Full/2-Way/Init), dead-time remaining, and interface',
      type: 'show',
      flagged: false,
      example: 'switch# show ip ospf neighbors\n\nOSPF Process 1, VRF default:\nNeighbor ID     Pri State         Dead Time Address         Interface\n10.0.0.1         1  Full/-        00:00:35  192.168.12.1    1/1/1\n10.0.0.2         1  Full/DR       00:00:38  192.168.23.2    1/1/2'
    }
  },
  {
    platform: 'windows',
    section: 'Networking',
    entry: {
      cmd: 'Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric',
      desc: 'Lists all IPv4 routes sorted by metric (lowest first) — includes destination, prefix length, next-hop, interface index, and route metric',
      type: 'show',
      flagged: false,
      example: 'PS C:\\> Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric | Format-Table ifIndex,DestinationPrefix,NextHop,RouteMetric\nifIndex DestinationPrefix   NextHop       RouteMetric\n------- -----------------   -------       -----------\n      4 0.0.0.0/0           192.168.1.1             1\n      4 192.168.1.0/24      0.0.0.0                 1\n      1 127.0.0.0/8         0.0.0.0                 1'
    }
  },
  {
    platform: 'aws',
    section: 'CloudWatch',
    entry: {
      cmd: 'aws cloudwatch describe-alarms --state-value ALARM',
      desc: 'Lists all CloudWatch alarms currently in ALARM state — shows alarm name, metric, threshold, comparison operator, and state reason',
      type: 'show',
      flagged: false,
      example: '$ aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[].{Name:AlarmName,Metric:MetricName,State:StateValue,Reason:StateReason}" --output table\n-------------------------------------------------------------------\n|                        DescribeAlarms                           |\n+----------------+-----------+---------+-------------------------+\n| CPUUtilization | CPU-Alert | ALARM   | Threshold crossed: ...  |\n| DiskReadOps    | Disk-Warn | ALARM   | Threshold crossed: ...  |\n+----------------+-----------+---------+-------------------------+'
    }
  },
  {
    platform: 'aruba_wlc',
    section: 'Logging & Diagnostics',
    entry: {
      cmd: 'show ap debug client-table ap-name <ap-name>',
      desc: 'Shows the client association table on a specific AP — displays MAC, BSSID, SSID, channel, RSSI, and association state for all clients',
      type: 'show',
      flagged: false,
      example: '(Aruba) #show ap debug client-table ap-name AP-FLOOR2-01\nClient Table for AP: AP-FLOOR2-01\nMAC Address        BSSID              SSID         Channel  RSSI  State\n-----------------  -----------------  -----------  -------  ----  -----\naa:bb:cc:dd:ee:ff  00:11:22:33:44:55  CorpWLAN     36       -58   Auth'
    }
  },
  {
    platform: 'ciscoios',
    section: 'Routing › BGP',
    entry: {
      cmd: 'show ip bgp regexp <as-path-regex>',
      desc: 'Filters the BGP table by AS-path regular expression — useful for finding all routes from a specific AS or AS-path pattern without a route-map',
      type: 'show',
      flagged: false,
      example: 'Router# show ip bgp regexp _65001$\nBGP table version is 4512, local router ID is 10.0.0.1\nStatus codes: s suppressed, d damped, h history, * valid, > best\n   Network          Next Hop        Metric LocPrf Weight Path\n*> 192.0.2.0/24    10.1.1.1             0             0 65100 65001\n*> 198.51.100.0/24 10.1.1.1             0             0 65100 65001'
    }
  },
  {
    platform: 'esxi',
    section: 'System',
    entry: {
      cmd: 'esxcli system module list',
      desc: 'Lists all loaded VMkernel modules (drivers and kernel extensions) with their enabled status and loaded state — useful for auditing drivers or troubleshooting hardware compatibility',
      type: 'show',
      flagged: false,
      example: '[root@esxi:~] esxcli system module list | head -10\nName                   Is Loaded  Is Enabled\n---------------------  ---------  ----------\natomics                true       true\ne1000e                 true       true\nnvme                   true       true\nvmklinux_9             true       true\nbnxtnet                true       true'
    }
  },
  {
    platform: 'ciscoiosxe_sw',
    section: 'Interfaces',
    entry: {
      cmd: 'show platform pm port-data interface <name>',
      desc: 'Shows platform port manager data for an interface — port-type, port-state, port-subblock state, and hardware programming details; useful for diagnosing ports stuck in wrong state',
      type: 'show',
      flagged: false,
      example: 'Switch# show platform pm port-data GigabitEthernet1/0/1\nIF_ID     : 0x000f\nIF Name   : GigabitEthernet1/0/1\nPort Type : GB_PHY_COPPER\nPort State: PORT_FSM_S_CONNECTED\nSpeed     : 1G\nDuplex    : Full\nAdmin     : UP\nLinestate : UP'
    }
  },
  {
    platform: 'openssl',
    section: 'Certificate Inspection',
    entry: {
      cmd: 'openssl x509 -in cert.pem -noout -purpose',
      desc: 'Checks the extended key usage and basic constraints to list what purposes the certificate is valid for (SSL client, SSL server, S/MIME, etc.) — quickly verifies certificate is appropriate for intended use',
      type: 'show',
      flagged: false,
      example: '$ openssl x509 -in server.pem -noout -purpose\nCertificate purposes:\nSSL client : No\nSSL client CA : No\nSSL server : Yes\nSSL server CA : No\nNetscape SSL server : Yes\nS/MIME signing : No\nS/MIME encryption : No\nCRL signing : No\nAny Purpose : Yes\nOCSP helper : No\nTime Stamp signing : No'
    }
  },
  {
    platform: 'aruba_cx',
    section: 'L3 Routing',
    entry: {
      cmd: 'show ip bgp summary',
      desc: 'Shows BGP neighbor summary — peer address, AS number, BGP version, message counts, up/down time, and number of prefixes received from each neighbor',
      type: 'show',
      flagged: false,
      example: 'switch# show ip bgp summary\nVRF : default\nBGP Summary\n-----------\n  Local AS               : 65000      BGP router-id        : 10.0.0.1\n  Peers Total            : 2          Established Count    : 2\n\nNeighbor         AS       MsgRcvd  MsgSent  Up/Down       State  PfxRcd\n10.1.1.1         65001    1250     875      5d00h12m      Estab  125\n10.1.1.2         65002    875      654      2d14h05m      Estab  89'
    }
  },
];

// ─── APPLY UPDATES ─────────────────────────────────────────────────────────

let examplesAdded = 0;
let skipped = 0;

for (const [platform, platformData] of Object.entries(data.platforms)) {
  for (const [section, cmds] of Object.entries(platformData.sections)) {
    for (const cmd of cmds) {
      if (!cmd.example && EXAMPLES[cmd.cmd] !== undefined) {
        cmd.example = EXAMPLES[cmd.cmd];
        examplesAdded++;
      } else if (!cmd.example && EXAMPLES[cmd.cmd] === undefined) {
        skipped++;
      }
    }
  }
}

// ─── INSERT NEW COMMANDS ───────────────────────────────────────────────────
for (const { platform, section, entry } of NEW_COMMANDS) {
  const sectionArr = data.platforms[platform]?.sections[section];
  if (!sectionArr) {
    console.error(`WARN: Platform/section not found: ${platform} / ${section}`);
    continue;
  }
  if (sectionArr.some(c => c.cmd === entry.cmd)) {
    console.log(`SKIP (exists): ${entry.cmd}`);
    continue;
  }
  sectionArr.push(entry);
  console.log(`ADDED: [${platform}/${section}] ${entry.cmd}`);
}

// ─── WRITE BACK ────────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n');

console.log(`\nDone. Examples added: ${examplesAdded}  Still missing: ${skipped}`);
