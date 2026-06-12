#!/usr/bin/env node
// Patch commands.json: AWS + Aruba AP + Aruba WLC examples and new commands
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/commands.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

function patchSection(cmds, patches) {
  for (const cmd of cmds) {
    if (patches[cmd.cmd] !== undefined && (!cmd.example || cmd.example.trim() === '')) {
      cmd.example = patches[cmd.cmd];
    }
  }
}
function addNewCmds(cmds, newCmds) {
  const existing = new Set(cmds.map(c => c.cmd));
  for (const nc of newCmds) {
    if (!existing.has(nc.cmd)) cmds.push(nc);
  }
}

// ─────────────────────────────────────────────
// AWS
// ─────────────────────────────────────────────
const aws = data.platforms.aws.sections;

patchSection(aws['EC2'], {
  'aws ec2 describe-volumes':
    '{\n    "Volumes": [{\n        "VolumeId": "vol-0abc123def456789",\n        "Size": 100,\n        "VolumeType": "gp3",\n        "State": "in-use",\n        "Iops": 3000,\n        "Throughput": 125,\n        "AvailabilityZone": "eu-west-2a",\n        "Attachments": [{"InstanceId":"i-0a1b2c3d4e5f67890","Device":"/dev/xvda","State":"attached"}]\n    }]\n}',
  'aws ec2 describe-security-groups':
    '{\n    "SecurityGroups": [{\n        "GroupId": "sg-0abc1234def56789",\n        "GroupName": "web-sg",\n        "Description": "Web tier security group",\n        "IpPermissions": [{\n            "IpProtocol": "tcp",\n            "FromPort": 443,\n            "ToPort": 443,\n            "IpRanges": [{"CidrIp": "0.0.0.0/0"}]\n        }]\n    }]\n}',
  'aws ec2 describe-vpcs':
    '{\n    "Vpcs": [{\n        "VpcId": "vpc-0abc1234",\n        "CidrBlock": "10.0.0.0/16",\n        "State": "available",\n        "IsDefault": false,\n        "Tags": [{"Key": "Name", "Value": "prod-vpc"}]\n    }]\n}',
  'aws ec2 describe-subnets':
    '{\n    "Subnets": [{\n        "SubnetId": "subnet-0abc1234",\n        "VpcId": "vpc-0abc1234",\n        "CidrBlock": "10.0.1.0/24",\n        "AvailabilityZone": "eu-west-2a",\n        "AvailableIpAddressCount": 246,\n        "Tags": [{"Key": "Name", "Value": "web-subnet-a"}]\n    }]\n}',
  'aws ec2 describe-route-tables':
    '{\n    "RouteTables": [{\n        "RouteTableId": "rtb-0abc1234",\n        "VpcId": "vpc-0abc1234",\n        "Routes": [\n            {"DestinationCidrBlock":"0.0.0.0/0","NatGatewayId":"nat-0abc1234","State":"active"},\n            {"DestinationCidrBlock":"10.0.0.0/16","GatewayId":"local","State":"active"}\n        ]\n    }]\n}',
  'aws ec2 describe-network-interfaces':
    '{\n    "NetworkInterfaces": [{\n        "NetworkInterfaceId": "eni-0abc1234",\n        "PrivateIpAddress": "10.0.1.42",\n        "Status": "in-use",\n        "Description": "Primary network interface",\n        "Attachment": {"InstanceId": "i-0a1b2c3d4e5f67890", "DeviceIndex": 0}\n    }]\n}',
  'aws ec2 describe-addresses':
    '{\n    "Addresses": [{\n        "PublicIp": "54.247.12.34",\n        "AllocationId": "eipalloc-0abc1234",\n        "AssociationId": "eipassoc-0abc1234",\n        "InstanceId": "i-0a1b2c3d4e5f67890",\n        "PrivateIpAddress": "10.0.1.42",\n        "Domain": "vpc"\n    }]\n}',
  'aws ec2 describe-images --owners self':
    '{\n    "Images": [{\n        "ImageId": "ami-0abc1234def56789",\n        "Name": "golden-ubuntu-22.04-2026-05-01",\n        "State": "available",\n        "Architecture": "x86_64",\n        "RootDeviceType": "ebs",\n        "VirtualizationType": "hvm",\n        "CreationDate": "2026-05-01T10:00:00.000Z"\n    }]\n}',
  'aws ec2 describe-instance-status':
    '{\n    "InstanceStatuses": [{\n        "InstanceId": "i-0a1b2c3d4e5f67890",\n        "InstanceState": {"Name": "running"},\n        "SystemStatus": {"Status": "ok"},\n        "InstanceStatus": {"Status": "ok"},\n        "Events": []\n    }]\n}',
  'aws ec2 describe-instances --filters Name=instance-state-name,Values=running --query \'Reservations[].Instances[].[InstanceId,Tags[?Key==`Name`].Value|[0],PrivateIpAddress]\' --output table':
    '-----------------------------------------------------\n|                  DescribeInstances                |\n+----------------------+-----------+----------------+\n| i-0a1b2c3d4e5f67890  | web01     | 10.0.1.42      |\n| i-0b2c3d4e5f678901   | db01      | 10.0.2.55      |\n| i-0c3d4e5f67890123   | app01     | 10.0.3.88      |\n+----------------------+-----------+----------------+',
  'aws ec2 describe-network-interfaces --filters Name=addresses.private-ip-address,Values=<ip>':
    '{\n    "NetworkInterfaces": [{\n        "NetworkInterfaceId": "eni-0abc1234",\n        "PrivateIpAddress": "10.0.1.42",\n        "Description": "Primary network interface",\n        "Attachment": {"InstanceId": "i-0a1b2c3d4e5f67890"}\n    }]\n}',
  'aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=<subnet>':
    '{\n    "RouteTables": [{"RouteTableId": "rtb-0abc1234","VpcId": "vpc-0abc1234","Routes": [{"DestinationCidrBlock":"0.0.0.0/0","NatGatewayId":"nat-0abc1234","State":"active"}]}]\n}',
  'aws ec2 describe-nat-gateways --filter Name=state,Values=available':
    '{\n    "NatGateways": [{\n        "NatGatewayId": "nat-0abc1234def56789",\n        "State": "available",\n        "VpcId": "vpc-0abc1234",\n        "SubnetId": "subnet-0abc1234",\n        "NatGatewayAddresses": [{"PublicIp":"54.247.12.34","PrivateIp":"10.0.1.100","AllocationId":"eipalloc-0abc1234"}]\n    }]\n}',
  'aws ec2 describe-vpc-endpoints':
    '{\n    "VpcEndpoints": [{\n        "VpcEndpointId": "vpce-0abc1234",\n        "VpcEndpointType": "Gateway",\n        "VpcId": "vpc-0abc1234",\n        "ServiceName": "com.amazonaws.eu-west-2.s3",\n        "State": "available"\n    }]\n}',
  'aws ec2 start-instances --instance-ids <id>':
    '{\n    "StartingInstances": [{"InstanceId":"i-0a1b2c3d4e5f67890","CurrentState":{"Name":"pending"},"PreviousState":{"Name":"stopped"}}]\n}',
  'aws ec2 stop-instances --instance-ids <id>':
    '{\n    "StoppingInstances": [{"InstanceId":"i-0a1b2c3d4e5f67890","CurrentState":{"Name":"stopping"},"PreviousState":{"Name":"running"}}]\n}',
  'aws ec2 get-console-output --instance-id <id>':
    '{\n    "InstanceId": "i-0a1b2c3d4e5f67890",\n    "Output": "[ 0.000000] Linux version 5.15.0-1054-aws...\n[    0.612345] ACPI: BIOS IRQ0 pin2 Override\n...(up to 64 KB of console output)",\n    "Timestamp": "2026-06-12T08:00:00.000Z"\n}',
  'aws ec2 describe-instance-status --instance-ids <id> --include-all-instances':
    '{\n    "InstanceStatuses": [{\n        "InstanceId": "i-0a1b2c3d4e5f67890",\n        "InstanceState": {"Name": "running"},\n        "SystemStatus": {"Status": "ok","Details": [{"Name":"reachability","Status":"passed"}]},\n        "InstanceStatus": {"Status": "ok","Details": [{"Name":"reachability","Status":"passed"}]},\n        "Events": []\n    }]\n}',
  'aws ec2 modify-instance-attribute --instance-id <id> --groups <sg1> <sg2>':
    '(No output on success — security groups replaced on the instance)',
});

patchSection(aws['S3'], {
  'aws s3 ls s3://<bucket>':
    '                           PRE images/\n                           PRE logs/\n2026-05-15 10:22:11       4821 index.html\n2026-05-15 10:22:12     184321 styles.css\n2026-06-01 09:11:55   18432100 app-bundle.js',
  'aws s3 cp <src> <dst>':
    'upload: ./report.pdf to s3://acme-data-lake/reports/report.pdf',
  'aws s3 sync <src> <dst>':
    'upload: ./dist/index.html to s3://acme-static-assets/index.html\nupload: ./dist/app.js to s3://acme-static-assets/app.js\nupload: ./dist/styles.css to s3://acme-static-assets/styles.css',
  'aws s3 rm s3://<bucket>/<file>':
    'delete: s3://acme-data-lake/reports/old-report.pdf',
  'aws s3 mb s3://<bucket>':
    'make_bucket: s3://my-new-bucket-2026',
  'aws s3 rb s3://<bucket>':
    'remove_bucket: s3://my-new-bucket-2026',
  'aws s3api get-bucket-acl --bucket <bucket>':
    '{\n    "Owner": {"DisplayName": "admin","ID": "abc123"},\n    "Grants": [{"Grantee":{"Type":"CanonicalUser","ID":"abc123"},"Permission":"FULL_CONTROL"}]\n}',
  'aws s3api get-bucket-policy --bucket <bucket>':
    '{"Version":"2012-10-17","Statement":[{"Sid":"AllowCloudFront","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::acme-static-assets/*"}]}',
  'aws s3api list-object-versions --bucket <bucket>':
    '{\n    "Versions": [{"Key":"index.html","VersionId":"abc123","IsLatest":true,"LastModified":"2026-06-01T09:11:55Z","Size":4821}],\n    "DeleteMarkers": []\n}',
  'aws s3api list-buckets --query "Buckets[].Name"':
    '[\n    "cf-templates-corp-eu-west-2",\n    "acme-data-lake",\n    "acme-logs-archive",\n    "acme-static-assets"\n]',
  'aws s3api get-bucket-location --bucket <b>':
    '{\n    "LocationConstraint": "eu-west-2"\n}',
  'aws s3api get-bucket-versioning --bucket <b>':
    '{\n    "Status": "Enabled",\n    "MFADelete": "Disabled"\n}',
  'aws s3api get-bucket-policy --bucket <b> --output text --query Policy | jq .':
    '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Sid": "AllowSSLRequestsOnly",\n      "Effect": "Deny",\n      "Principal": "*",\n      "Action": "s3:*",\n      "Resource": ["arn:aws:s3:::acme-data-lake","arn:aws:s3:::acme-data-lake/*"],\n      "Condition": {"Bool": {"aws:SecureTransport": "false"}}\n    }\n  ]\n}',
  'aws s3 sync <src> <dst> --delete --exact-timestamps':
    'upload: ./dist/app.v2.js to s3://acme-static-assets/app.v2.js\ndelete: s3://acme-static-assets/app.v1.js',
  'aws s3api list-object-versions --bucket <b> --prefix <p>':
    '{\n    "Versions": [{"Key":"reports/q1.pdf","VersionId":"ver2","IsLatest":true,"Size":182444}],\n    "DeleteMarkers": [{"Key":"reports/q1.pdf","VersionId":"ver1","IsLatest":false}]\n}',
  'aws s3 presign s3://<b>/<key> --expires-in 3600':
    'https://acme-data-lake.s3.eu-west-2.amazonaws.com/reports/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA...&X-Amz-Expires=3600&X-Amz-Signature=abc...',
});

patchSection(aws['CloudWatch'], {
  'aws cloudwatch describe-alarms':
    '{\n    "MetricAlarms": [{\n        "AlarmName": "HighCPU-web01",\n        "AlarmDescription": "CPU > 80% for 5 min",\n        "StateValue": "OK",\n        "MetricName": "CPUUtilization",\n        "Namespace": "AWS/EC2",\n        "Statistic": "Average",\n        "Period": 300,\n        "Threshold": 80.0,\n        "ComparisonOperator": "GreaterThanThreshold"\n    }]\n}',
  'aws cloudwatch get-metric-statistics':
    '{\n    "Datapoints": [\n        {"Timestamp":"2026-06-12T09:00:00Z","Average":12.34,"Unit":"Percent"},\n        {"Timestamp":"2026-06-12T09:05:00Z","Average":15.21,"Unit":"Percent"}\n    ],\n    "Label": "CPUUtilization"\n}',
  'aws cloudwatch list-metrics':
    '{\n    "Metrics": [\n        {"Namespace":"AWS/EC2","MetricName":"CPUUtilization","Dimensions":[{"Name":"InstanceId","Value":"i-0a1b2c3d4e5f67890"}]},\n        {"Namespace":"AWS/EC2","MetricName":"NetworkIn","Dimensions":[{"Name":"InstanceId","Value":"i-0a1b2c3d4e5f67890"}]}\n    ]\n}',
  'aws logs describe-log-groups':
    '{\n    "logGroups": [\n        {"logGroupName":"/aws/lambda/my-function","retentionInDays":30,"storedBytes":182441984},\n        {"logGroupName":"/aws/ec2/web01","retentionInDays":7,"storedBytes":941234}\n    ]\n}',
  'aws logs describe-log-streams --log-group-name <group>':
    '{\n    "logStreams": [\n        {"logStreamName":"i-0a1b2c3d4e5f67890","lastEventTimestamp":1749714137000,"storedBytes":94132},\n        {"logStreamName":"i-0b2c3d4e5f678901","lastEventTimestamp":1749714000000,"storedBytes":84210}\n    ]\n}',
  'aws logs get-log-events --log-group-name <group> --log-stream-name <stream>':
    '{\n    "events": [\n        {"timestamp":1749714137000,"message":"2026-06-12 09:42:17 INFO Starting request processing","ingestionTime":1749714138000},\n        {"timestamp":1749714138000,"message":"2026-06-12 09:42:18 INFO Request completed in 42ms","ingestionTime":1749714139000}\n    ]\n}',
  'aws logs tail <group>':
    '2026-06-12T09:42:17 INFO Starting request processing\n2026-06-12T09:42:18 INFO Request completed in 42ms\n2026-06-12T09:42:20 WARN High memory usage: 87%',
  'aws logs filter-log-events --log-group-name <group> --filter-pattern <pattern>':
    '{\n    "events": [\n        {"logStreamName":"i-0a1b2c3d","timestamp":1749714137000,"message":"ERROR Connection refused to db.internal:5432","eventId":"123"},\n        {"logStreamName":"i-0a1b2c3d","timestamp":1749714198000,"message":"ERROR Timeout on db query","eventId":"124"}\n    ]\n}',
  'aws logs put-retention-policy --log-group-name <group> --retention-in-days <days>':
    '(No output on success — retention policy updated)',
  'aws logs delete-log-group --log-group-name <group>':
    '(No output on success — log group and all streams deleted)',
  'aws logs tail /aws/lambda/<fn> --follow --format short':
    'START RequestId: abc-123 Version: $LATEST\nEND RequestId: abc-123\nREPORT RequestId: abc-123  Duration: 42.12 ms  Billed Duration: 43 ms  Memory Size: 512 MB  Max Memory Used: 98 MB',
  'aws logs filter-log-events --log-group-name <g> --filter-pattern "ERROR"':
    '{\n    "events": [\n        {"timestamp":1749714137000,"message":"ERROR Unhandled exception: NullPointerException","logStreamName":"app/web01/abc123"}\n    ],\n    "searchedLogStreams": [{"logStreamName":"app/web01/abc123","searchedCompletely":true}]\n}',
  'aws logs describe-log-groups --query "logGroups[].logGroupName"':
    '[\n    "/aws/lambda/api-handler",\n    "/aws/lambda/image-processor",\n    "/aws/ec2/web01",\n    "/aws/rds/instance/prod-db/postgresql"\n]',
  'aws cloudwatch set-alarm-state --alarm-name <n> --state-value ALARM --state-reason "test"':
    '(No output on success — alarm state forced to ALARM; SNS notifications triggered)',
  'aws cloudwatch put-metric-data --namespace <ns> --metric-name <m> --value 1 --dimensions Host=<h>':
    '(No output on success — custom metric point published)',
  'aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[].AlarmName"':
    '[\n    "HighCPU-web01",\n    "DiskFull-db01"\n]',
  'aws logs start-query --log-group-name <g> --start-time <unix> --end-time <unix> --query-string "fields @timestamp, @message | sort @timestamp desc | limit 50"':
    '{\n    "queryId": "9ab12345-6789-abcd-ef01-234567890abc"\n}',
});

patchSection(aws['IAM'], {
  'aws iam get-user':
    '{\n    "User": {\n        "Path": "/",\n        "UserName": "matthew.witherford",\n        "UserId": "AIDAEXAMPLE12345",\n        "Arn": "arn:aws:iam::123456789012:user/matthew.witherford",\n        "CreateDate": "2025-01-15T09:00:00+00:00",\n        "PasswordLastUsed": "2026-06-12T08:30:00+00:00"\n    }\n}',
  'aws iam list-users --query "Users[].UserName"':
    '[\n    "alice.smith",\n    "bob.jones",\n    "cicd-deploy",\n    "matthew.witherford",\n    "terraform-svc"\n]',
  'aws iam list-roles --query "Roles[?contains(RoleName,\'<substr>\')].RoleName"':
    '[\n    "LambdaExecutionRole",\n    "EC2SSMRole",\n    "ECSTaskExecutionRole"\n]',
  'aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names <svc>:<action> --resource-arns <arn>':
    '{\n    "EvaluationResults": [{\n        "EvalActionName": "s3:GetObject",\n        "EvalResourceName": "arn:aws:s3:::acme-data-lake/*",\n        "EvalDecision": "allowed",\n        "MatchedStatements": [{"SourcePolicyId":"AmazonS3ReadOnlyAccess","StartPosition":{"Line":1,"Column":1}}]\n    }]\n}',
  'aws iam get-policy --policy-arn <arn>':
    '{\n    "Policy": {\n        "PolicyName": "AmazonS3ReadOnlyAccess",\n        "PolicyId": "ANPAEXAMPLE12345",\n        "Arn": "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",\n        "DefaultVersionId": "v1",\n        "AttachmentCount": 3,\n        "IsAttachable": true\n    }\n}',
  'aws iam get-policy-version --policy-arn <arn> --version-id v1 --query Policy.PolicyVersion.Document':
    '{\n    "Version": "2012-10-17",\n    "Statement": [{"Effect":"Allow","Action":["s3:Get*","s3:List*","s3:Describe*"],"Resource":"*"}]\n}',
});

patchSection(aws['VPC'], {
  'aws ec2 describe-vpcs --query "Vpcs[].[VpcId,CidrBlock,IsDefault]" --output table':
    '------------------------------------------\n|           DescribeVpcs                 |\n+----------------+-----------------+-------+\n| vpc-0abc1234   | 10.0.0.0/16     | False |\n| vpc-0def5678   | 172.31.0.0/16   | True  |\n+----------------+-----------------+-------+',
  'aws ec2 describe-security-groups --group-ids <sg> --query "SecurityGroups[].IpPermissions"':
    '[[\n    {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},\n    {"IpProtocol":"tcp","FromPort":22,"ToPort":22,"IpRanges":[{"CidrIp":"10.0.0.0/8","Description":"Internal only"}]}\n]]',
  'aws ec2 describe-flow-logs --filter Name=resource-id,Values=<vpc-id>':
    '{\n    "FlowLogs": [{\n        "FlowLogId": "fl-0abc1234",\n        "FlowLogStatus": "ACTIVE",\n        "ResourceId": "vpc-0abc1234",\n        "TrafficType": "ALL",\n        "LogDestinationType": "cloud-watch-logs",\n        "LogGroupName": "/aws/vpc/flowlogs"\n    }]\n}',
  'aws ec2 create-flow-logs --resource-type VPC --resource-ids <vpc-id> --traffic-type ALL --log-destination-type cloud-watch-logs --log-group-name <lg> --deliver-logs-permission-arn <role>':
    '{\n    "FlowLogIds": ["fl-0new12345"],\n    "Unsuccessful": []\n}',
  'aws ec2 describe-transit-gateway-route-tables':
    '{\n    "TransitGatewayRouteTables": [{\n        "TransitGatewayRouteTableId": "tgw-rtb-0abc1234",\n        "TransitGatewayId": "tgw-0abc1234",\n        "State": "available",\n        "DefaultAssociationRouteTable": true,\n        "DefaultPropagationRouteTable": true\n    }]\n}',
});

// Add 2 new AWS commands
addNewCmds(aws['EC2'], [
  {
    cmd: 'aws elbv2 describe-load-balancers --query "LoadBalancers[].[LoadBalancerName,State.Code,Type,DNSName]" --output table',
    desc: 'List all Application and Network load balancers with state and DNS name',
    type: 'show',
    flagged: false,
    example: '---------------------------------------------------------------\n|           DescribeLoadBalancers                             |\n+-------------------+---------+-------------+------------------+\n| prod-alb          | active  | application | prod-alb-123456789.eu-west-2.elb.amazonaws.com |\n| internal-nlb      | active  | network     | internal-nlb-abc.elb.eu-west-2.amazonaws.com   |\n+-------------------+---------+-------------+------------------+',
  },
]);
addNewCmds(aws['EC2'], [
  {
    cmd: 'aws rds describe-db-instances --query "DBInstances[].[DBInstanceIdentifier,DBInstanceStatus,DBInstanceClass,Engine,Endpoint.Address]" --output table',
    desc: 'List RDS instances with status, class, engine and endpoint hostname',
    type: 'show',
    flagged: false,
    example: '----------------------------------------------------------------------\n|                    DescribeDBInstances                             |\n+-----------+-----------+-------------+----------+--------------------+\n| prod-db   | available | db.t3.large | postgres | prod-db.abc123.eu-west-2.rds.amazonaws.com |\n| staging-db| available | db.t3.small | postgres | staging-db.def456.eu-west-2.rds.amazonaws.com |\n+-----------+-----------+-------------+----------+--------------------+',
  },
]);

// ─────────────────────────────────────────────
// ARUBA AP
// ─────────────────────────────────────────────
const aap = data.platforms.aruba_ap.sections;

patchSection(aap['System & Status'], {
  'show version':
    'Aruba AP-615 (Aruba Networks) 10.6.0.2-10.6.0.2\n   Version 10.6.0.2\n   Built: 2026-01-14 12:00 UTC\nSerial number: CNXXXXXXX\nHW Revision: 0x06\nFirmware partition: part0\nUptime: 12 days 04 hours 21 minutes',
  'show summary':
    'Name         : ap-floor3\nIP Address   : 10.0.50.23 / 255.255.255.0\nGateway      : 10.0.50.1\nRole         : Conductor\nMembers      : 4\nConductor IP : 10.0.50.23\nSSIDs        : Corp-WiFi, Guest',
  'show running-config':
    'version 10.6.0.2\nvirtual-controller-country GB\nvirtual-controller-key ABCDEF1234567890\nhostname ap-floor3\nclock timezone GMT 0 0\nsyslog-server 10.0.0.50\nntp-server 10.0.0.51',
  'show ap-env':
    'Aruba Part No.    : APIN0615\nSerial No.        : CNXXXXXXX\nModel             : AP-615\nHW Rev No.        : 0x06\nBootfile          : aruba615_nand\nMaster IP         : 10.0.50.23\nAP Group          : floor3-grp\nVirtual Switch    : enabled',
  'show clock':
    'Current Time: Thu Jun 12 09:42:17 GMT 2026',
  'show country':
    'Country Code: GB\nCountry Name: United Kingdom',
  'show inventory':
    'NAME: AP-615\nDESCR: Aruba 615 Series\nPID: APIN0615\nVID: V01\nSN: CNXXXXXXX',
  'show memory':
    'Total Memory: 512 MB\nUsed Memory : 268 MB\nFree Memory : 244 MB',
  'show stats':
    'BSSID              RX Packets  TX Packets  RX Bytes   TX Bytes\n00:1a:1e:ab:cd:e0  1824541     2411032     184214124  241103288\n00:1a:1e:ab:cd:e1  821345      1024788     82134512   102478800',
  'show tech-support':
    '### show version ###\nAruba AP-615 10.6.0.2 ...\n### show running-config ###\n...\n(Full diagnostic output; use file redirect or AirWave extraction)',
});

patchSection(aap['Network'], {
  'show ip interface brief':
    'Interface  IP Address      Netmask         Type    Status\neth0       10.0.50.23      255.255.255.0   STATIC  UP\nlo         127.0.0.1       255.0.0.0       STATIC  UP',
  'show vlan':
    'VLAN  Type     Interface   IP Address      Netmask\n1     Native   eth0        10.0.50.23      255.255.255.0\n10    Tagged   Corp-WiFi\n20    Tagged   Guest',
  'show port status':
    'Port  Type      Speed    Duplex  Link  POE\ne0    1000Base  1 Gbps   Full    Up    50.0W (Class 8)\ne1    n/a       n/a      n/a     Down  n/a',
  'show interface brief':
    'Interface  Type      Status  Speed  Description\ne0         Ethernet  Up      1G     Uplink to switch\ne1         Ethernet  Down    n/a    Unused\nlo         Loopback  Up      n/a    Loopback',
  'ping 1.1.1.1':
    'PING 1.1.1.1 (1.1.1.1): 56 data bytes\n64 bytes from 1.1.1.1: seq=0 ttl=56 time=4.837 ms\n64 bytes from 1.1.1.1: seq=1 ttl=56 time=4.621 ms\n--- 1.1.1.1 ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss\nround-trip min/avg/max = 4.621/4.729/4.837 ms',
  'traceroute 1.1.1.1':
    'traceroute to 1.1.1.1, 30 hops max\n 1  10.0.50.1 (10.0.50.1)  0.764 ms  0.732 ms  0.711 ms\n 2  192.168.1.1 (192.168.1.1)  2.121 ms  2.015 ms  2.119 ms\n 3  1.1.1.1 (1.1.1.1)  4.837 ms  4.621 ms  4.901 ms',
});

patchSection(aap['Wireless / SSID'], {
  'show network':
    'Name         Status  BSSID              Band   Ch  Sec         Clients\nCorp-WiFi    Up      00:1a:1e:ab:cd:e0  5GHz   36  WPA3-EAP    14\nCorp-WiFi    Up      00:1a:1e:ab:cd:e2  2.4GHz 6   WPA3-EAP    3\nGuest        Up      00:1a:1e:ab:cd:e1  5GHz   36  WPA2-PSK    2',
  'show ssid':
    'SSID       BSSID              Clients  Band   Ch  Security\nCorp-WiFi  00:1a:1e:ab:cd:e0  14       5G     36  WPA3-Enterprise\nGuest      00:1a:1e:ab:cd:e1  2        5G     36  WPA2-Personal',
  'show ap radio-summary':
    'Radio  Band   Ch  Ch Width  Pwr(dBm)  EIRP  Clients  Mode\n0      5GHz   36  80MHz     17        20    14       Access\n1      2.4GHz 6   20MHz     14        17    3        Access',
  'show ap channel':
    'Radio  Band   Current Ch  Config Ch  Pwr  Max Pwr\n0      5GHz   36          ARM        17   20\n1      2.4GHz 6           ARM        14   17',
  'show ap arm-history':
    'Time                 Radio  Old Ch  New Ch  Old Pwr  New Pwr  Reason\n2026-06-12 07:14:32  0      44      36      17       17       Interference avoidance\n2026-06-11 23:00:05  0      36      44      17       17       ARM scheduled scan',
  'show ap monitor scan-info':
    'Band   Channel  Nbr APs  CCI  Utilization  Noise (dBm)\n5GHz   36       3        1    14%          -94\n5GHz   40       2        0    8%           -95\n2.4GHz 6        5        2    32%          -92',
});

patchSection(aap['Clients'], {
  'show clients':
    'MAC               IP           SSID       Signal  Speed   Role\n00:50:56:ab:cd:01  10.0.50.100  Corp-WiFi  -58dBm  866M    employee\n00:50:56:ab:cd:02  10.0.50.101  Corp-WiFi  -62dBm  400M    employee\naa:bb:cc:dd:ee:ff  10.0.60.200  Guest      -71dBm  144M    guest',
  'show client mac <mac>':
    'MAC Address        : 00:50:56:ab:cd:01\nIP Address         : 10.0.50.100\nSSID               : Corp-WiFi\nBSSID              : 00:1a:1e:ab:cd:e0\nBand               : 5GHz\nChannel            : 36\nTx Rate            : 866 Mbps\nRx Rate            : 866 Mbps\nSignal Strength    : -58 dBm\nAP Name            : ap-floor3\nRole               : employee\nAuth Type          : 802.1X/EAP\nConnect Time       : 04:21:13',
  'show user-table':
    'Users:1\nFlags: R=Regular, A=AP-User, W=WirelessUser, V=VPN, a=auth req, l=logoff\nName      IP              MAC               ROLE      Age  AP   11h  Fwd\n-         10.0.50.100     00:50:56:ab:cd:01 employee  21m  ap-floor3  a  -',
  'show client roaming-history':
    'MAC               From AP     To AP       SSID       Time\n00:50:56:ab:cd:01  ap-floor2   ap-floor3  Corp-WiFi  2026-06-12 08:14:22\n00:50:56:ab:cd:01  ap-floor1   ap-floor2  Corp-WiFi  2026-06-12 07:55:41',
  'aaa user delete mac <mac>':
    '(Client forced off; will need to re-authenticate)',
});

patchSection(aap['Cluster (Instant)'], {
  'show cluster':
    'Cluster Name: ap-floor-cluster\nRole    AP Name    IP            MAC               Clients\nConductor ap-floor3  10.0.50.23    00:1a:1e:ab:cd:e0  17\nMember  ap-floor4  10.0.50.24    00:1a:1e:ab:cd:f0  12\nMember  ap-floor5  10.0.50.25    00:1a:1e:ab:cd:f1  9\nMember  ap-floor6  10.0.50.26    00:1a:1e:ab:cd:f2  5',
  'show cluster-info':
    'Virtual Controller IP: 10.0.50.23\nCluster Name: ap-floor-cluster\nState: UP\nAPs: 4\nTotal Clients: 43\nCountry: GB',
  'show conductor':
    'AP Name      : ap-floor3\nIP Address   : 10.0.50.23\nMAC Address  : 00:1a:1e:ab:cd:e0\nModel        : AP-615\nUptime       : 12 days 04:21:13\nSoftware     : 10.6.0.2',
  'show summary support':
    'Virtual Controller:\n  Name: ap-floor-cluster\n  IP: 10.0.50.23\n  APs: 4 UP / 0 DOWN\n  Clients: 43\n  Uptime: 12 days\nSystem health: OK',
});

patchSection(aap['Mesh'], {
  'show ap mesh-link':
    'Mesh Link State: ACTIVE\nParent AP: not applicable (root AP)\nLink Quality: n/a\nDownstream APs: 1\n  ap-floor7  SNR:28  Link:72Mbps',
  'show ap mesh-topology':
    'ap-floor3 (Root)\n  └─ ap-floor7 (Mesh Portal)  SNR:28  Rate:72Mbps\n       └─ ap-floor8 (Mesh Point)  SNR:24  Rate:54Mbps',
  'show ap mesh-counters':
    'Mesh Tx Packets : 484521\nMesh Rx Packets : 512344\nMesh Tx Retries : 1423\nMesh Rx Drops   : 84\nLink Up Events  : 3',
});

patchSection(aap['Diagnostics'], {
  'show log':
    'Jun 12 09:41:55 ap-floor3 stm[1234]: <305012> <WARN> |AP ap-floor3| ARM: channel changed from 44 to 36 (radar detected)\nJun 12 09:40:11 ap-floor3 sapd[1234]: <127004> <INFO> |AP ap-floor3| Station 00:50:56:ab:cd:01 associated',
  'show log debug':
    'Jun 12 09:42:12 ap-floor3 sapd[1234]: <DBG> 11g_rate_update: sta 00:50:56:ab:cd:01 rate=866M\nJun 12 09:42:11 ap-floor3 stm[1234]: <DBG> ARM scan result: ch36 cca=14% bss=3',
  'show ap debug counters':
    'Tx Frames       : 4841032\nRx Frames       : 3821244\nTx Retries      : 12431\nRx Drops        : 441\nAssoc Success   : 843\nAssoc Fail      : 12\nAuth Success    : 845\nAuth Fail       : 3',
  'show ap debug radio-stats 0':
    'Radio 0 (5GHz) Statistics:\n  Channel       : 36\n  Tx Power      : 17 dBm\n  Noise Floor   : -94 dBm\n  Channel Util  : 14%\n  Rx CRC Errors : 1241\n  Tx Success    : 4128441\n  Tx Retries    : 12431',
  'show ap debug radio-stats 1':
    'Radio 1 (2.4GHz) Statistics:\n  Channel       : 6\n  Tx Power      : 14 dBm\n  Noise Floor   : -92 dBm\n  Channel Util  : 32%\n  Rx CRC Errors : 5412\n  Tx Success    : 821244\n  Tx Retries    : 24312',
  'show ap debug client-table':
    'MAC               IP           Band  Ch  Rate  SNR  RSSI   Age\n00:50:56:ab:cd:01  10.0.50.100  5G    36  866M  36   -58    21m\n00:50:56:ab:cd:02  10.0.50.101  5G    36  400M  32   -62    8m',
  'show airmatch report':
    'AirMatch Report: ap-floor-cluster\nLast optimisation: 2026-06-12 02:00:07\nRadio 0: channel 36 (score 92), power 17 dBm\nRadio 1: channel 6 (score 78), power 14 dBm',
  'show ap airmatch debug':
    'AirMatch state: enabled\nLast event: 2026-06-12 02:00:07 - Optimization applied\nPending changes: none\nEvent count: 14',
  'pcap start <interface> <bpf>':
    'Packet capture started on radio0 filter "host 10.0.50.100"\nCapture file: /tmp/pcap_radio0.pcap\nUse "show pcap status" to check progress',
  'show pcap status':
    'Interface  Filter                  Packets  File\nradio0     host 10.0.50.100         1241     /tmp/pcap_radio0.pcap\n(Use Ctrl+C or timeout to stop)',
});

patchSection(aap['Provisioning & Updates'], {
  'show ap-env':
    'Aruba Part No.    : APIN0615\nSerial No.        : CNXXXXXXX\nModel             : AP-615\nMaster IP         : 10.0.50.23\nAP Group          : floor3-grp',
  'show image version':
    'Partition 0: ArubaOS 10.6.0.2 (active)\nPartition 1: ArubaOS 10.5.0.3 (backup)\nBooted from: Partition 0',
  'ap-config-cluster master <ip>':
    '(AP provisioned to connect to VC/controller at <ip>; reboots to apply)',
  'apboot':
    '(AP initiating reboot sequence...)',
  'reload':
    '(AP initiating reload sequence...)',
});

// Add 1 new Aruba AP command
addNewCmds(aap['Clients'], [
  {
    cmd: 'show ap association',
    desc: 'Association table — all clients with BSSID, rates, SNR and connection time',
    type: 'show',
    flagged: false,
    example: 'bss 00:1a:1e:ab:cd:e0 \"Corp-WiFi\" freq 5180\n  sta 00:50:56:ab:cd:01  age 21:14  signal -58 dBm  last-rx 866 Mbps  last-tx 866 Mbps  rssi-min -65 rssi-max -52\n  sta 00:50:56:ab:cd:02  age  8:33  signal -62 dBm  last-rx 400 Mbps  last-tx 400 Mbps  rssi-min -68 rssi-max -58\nbss 00:1a:1e:ab:cd:e1 \"Guest\" freq 5180\n  sta aa:bb:cc:dd:ee:ff   age  4:22  signal -71 dBm  last-rx 144 Mbps  last-tx 144 Mbps',
  },
]);

// ─────────────────────────────────────────────
// ARUBA WLC
// ─────────────────────────────────────────────
const awlc = data.platforms.aruba_wlc.sections;

patchSection(awlc['System & Status'], {
  'show version':
    'Aruba Operating System Software.\nArubaOS (MODEL: Aruba7205), Version 8.11.2.2\nBUILT: 2026-01-08 12:00:00\nBuilt by user@bldhst\nROM: Bootstrap program is ArubaOS loader\nController uptime is 47 days 12 hours 30 minutes 15 seconds\nReloaded at 06:12:02 on Apr 25 2026\nProcessor: 8 x Intel(R) Xeon(R) D-1541 @ 2.10GHz, 16384 MB RAM, 120 GB Flash\nDefault boot partition: Partition 0: ArubaOS 8.11.2.2',
  'show inventory':
    'NAME: \"Aruba7205\"\nDESCR: \"Aruba 7205 Mobility Controller\"\nPID: Aruba7205\nVID: V01\nSN: CV7205XXXXXXX\n\nNAME: \"Power Supply\"\nDESCR: \"1000W AC Power Supply\"\nPID: JW827A\nSN: 5CF1234567',
  'show running-config':
    '!  ArubaOS Configuration\n!\nversion 8.11.2.2\nhostname aruba-mc01\nclock timezone EST -5 0\nip domain-name corp.example.com\nip name-server 10.0.0.53\n...',
  'show switches':
    'All Switches\n------------\nName           IP Address     Type         Version    Status\naruba-mm01     10.0.0.200     MM           8.11.2.2   up\naruba-mc01     10.0.0.201     MC (local)   8.11.2.2   up\naruba-mc02     10.0.0.202     MC           8.11.2.2   up',
  'show switchinfo':
    'Switch Role          : Mobility Controller\nSwitch MAC Address   : 00:1a:1e:00:11:22\nSwitch IP            : 10.0.0.201\nSwitch Name          : aruba-mc01\nBranch ID            : 0',
  'show clock':
    'Current Time: Thu Jun 12 09:42:17 EST 2026',
  'show country':
    'Country code: GB\nCountry name: United Kingdom',
  'show license':
    'Feature        License           Status         Quantity\n-----------   ----------------   -----------    --------\nPEFNG         PEFV-LIC-S         Enabled        0\nxSec          XSEC-LIC-S         Enabled        0\nAP            AP-LIC-S           Enabled        512\nRFP           RFP-LIC-S          Enabled        512',
  'show license-usage ap':
    'AP Licence: 512 total, 348 in use, 164 available',
  'show license-usage user':
    'User Licence: 2048 total, 1243 in use, 805 available',
  'show cpuload':
    'CPU total: 18%  (1-min average)\nCPU per-core:\n  Core 0: 22%\n  Core 1: 16%\n  Core 2: 19%\n  Core 3: 15%',
  'show memory':
    'Total Memory : 16384 MB\nUsed Memory  :  9241 MB\nFree Memory  :  7143 MB\nBuffers      :   412 MB\nCached       :  2841 MB',
  'show storage':
    'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       120G   42G   72G  37% /flash',
  'show keys all':
    'Key Name           Type    Size  Expires\ndefault-controlplane RSA   2048  never\naruba-internal-cert  RSA   2048  2027-01-01',
  'show airwave':
    'AirWave/Central Status:\n  Address      : aruba-central.example.com\n  State        : Connected\n  HTTPS Mode   : Enabled\n  Last hb      : Jun 12 09:42:00',
});

patchSection(awlc['AP Management'], {
  'show ap database':
    'AP Database\n-----------\nName              Group        AP Type  IP Address     Flags  Status\nap-floor1         default-ap   615      10.0.50.11     c      Up\nap-floor2         default-ap   615      10.0.50.12     c      Up\nap-floor3         default-ap   615      10.0.50.13     c      Up\nap-roof1          roof-grp     635      10.0.50.14     c      Up',
  'show ap database long':
    'Name              Group     AP Type  IP Address    Version      Location     Status\nap-floor1         default   615      10.0.50.11    10.6.0.2     Floor 1 NE   Up\nap-floor2         default   615      10.0.50.12    10.6.0.2     Floor 1 SW   Up',
  'show ap active':
    'Active AP Table\n---------------\nName       Group      Ch  Rx(Mb) Tx(Mb) Clients\nap-floor1  default-ap  36    12.4   28.4  17\nap-floor2  default-ap  40     9.1   18.2  12\nap-floor3  default-ap  36    14.2   31.0  14\nTotal APs: 348, Total Clients: 1243',
  'show ap details ap-name <name>':
    'AP details for ap-floor1\n  IP Address    : 10.0.50.11\n  MAC Address   : 00:1a:1e:ab:cd:e0\n  Model         : AP-615\n  Group         : default-ap\n  Version       : 10.6.0.2\n  Uptime        : 47 days 12:30:15\n  Radio 0       : 5GHz, ch 36, 17 dBm, 17 clients\n  Radio 1       : 2.4GHz, ch 6, 14 dBm, 3 clients\n  PoE class     : Class 8 (51W)',
  'show ap radio-summary':
    'AP Name        Band  Ch  Pwr  ChanUtil  Clients  Mode\nap-floor1      5G    36  17   14%       17       Access\nap-floor1      2.4G  6   14   32%        3       Access\nap-floor2      5G    40  17    9%       12       Access',
  'show ap radio-summary ap-name <name>':
    'AP Name       Radio  Band  Ch  Ch Width  Pwr  ChanUtil  SNR  Clients\nap-floor1     0      5G    36  80MHz     17   14%       36   17\nap-floor1     1      2.4G  6   20MHz     14   32%       28    3',
  'show ap radio-database':
    'Name          R0Ch  R0Pwr  R1Ch  R1Pwr  Clients\nap-floor1     36    17     6     14     20\nap-floor2     40    17     1     14     14\nap-floor3     36    17     11    14     17',
  'show ap config ap-name <name>':
    'Effective AP Config for ap-floor1:\n  AP Group     : default-ap\n  AP Name Profile: ap-floor1-profile\n  PoE Profile  : poe-class8\n  Dot11a Profile: 80mhz-profile\n  Dot11g Profile: default-a\n  VAP List     : Corp-WiFi, Guest',
  'show ap arm-history ap-name <name>':
    'Time                 Radio  Old Ch  New Ch  Old Pwr  New Pwr  Reason\n2026-06-12 07:14:32  0      44      36      17       17       Radar detected (DFS)\n2026-06-11 23:00:05  0      36      44      17       17       ARM scheduled optimisation',
  'show ap snr-info ap-name <name> radio 0':
    'AP ap-floor1 Radio 0 (5GHz) SNR Info:\n  Min SNR (last hour)  : 24 dB\n  Max SNR (last hour)  : 42 dB\n  Avg SNR (last hour)  : 36 dB\n  Current SNR          : 36 dB',
  'show ap monitor active-laser-beams ap-name <name>':
    'ap-floor1 Radio 0 Spectrum Analysis:\n  Detected interference: None\n  Co-channel APs        : 3 (strongest -72 dBm)\n  Non-WiFi devices      : 0',
  'show ap remote debug magic-number ap-name <name>':
    'magic number for ap-floor1 is: 1234567890',
  'show ap profile-usage ap-name <name>':
    'Profile              Applied Value\nap-name              ap-floor1\nap-group             default-ap\ndot11a-radio-profile 80mhz-profile\ndot11g-radio-profile default-a',
  'show ap group':
    'AP Group List\n-------------\ndefault-ap\nroof-grp\nfloor-grp',
  'show ap-group <name>':
    'AP Group \"default-ap\"\n  Virtual AP list : Corp-WiFi, Guest\n  Dot11a Profile  : 80mhz-profile\n  Dot11g Profile  : default-a\n  PoE Profile     : poe-class8',
  'show ap lms-distribution':
    'AP Name       Primary LMS      Standby LMS      Current LMS\nap-floor1     10.0.0.201       10.0.0.202       Primary\nap-floor2     10.0.0.201       10.0.0.202       Primary\nap-floor3     10.0.0.202       10.0.0.201       Primary',
});

patchSection(awlc['WLAN & SSID'], {
  'show wlan ssid-profile':
    'SSID Profile List\n-----------------\nCorp-WiFi\nGuest\nIoT-Devices',
  'show wlan ssid-profile <name>':
    'SSID Profile \"Corp-WiFi\"\n  SSID              : Corp-WiFi\n  WPA Passphrase    : (configured)\n  Encryption        : wpa3-aes-256-ccm\n  Inactivity Timeout: 1000 sec\n  Max Clients       : 64\n  Band Steering     : enabled',
  'show wlan virtual-ap':
    'Virtual AP Profile List\n-----------------------\nCorp-WiFi\nGuest\nIoT-Devices',
  'show wlan virtual-ap <name>':
    'Virtual AP Profile \"Corp-WiFi\"\n  SSID Profile  : Corp-WiFi\n  AAA Profile   : dot1x-profile\n  Forward Mode  : tunnel\n  Band Steering : enabled',
  'show aaa profile':
    'AAA Profile List\n----------------\ndot1x-profile\nguest-profile\ncaptive-portal-profile',
  'show aaa profile <name>':
    'AAA Profile \"dot1x-profile\"\n  Auth Server Group       : radius-grp\n  Auth Protocol           : 802.1x\n  Machine Authentication  : optional\n  RFC 3576 Server         : 10.0.0.50',
  'show ap-group <name>':
    'AP Group \"default-ap\"\n  Virtual AP list : Corp-WiFi, Guest\n  Dot11a Profile  : 80mhz-profile\n  Dot11g Profile  : default-a',
});

patchSection(awlc['Clients & Users'], {
  'show user':
    'Users: 1243\nFlags: R=Regular A=AP-User W=WirelessUser V=VPN a=auth-req l=logoff\nTotals: 1243 Regular, 0 VPN, 0 Wired\nName/IP            MAC               SSID       AP         Role      Age  Auth\n10.0.50.100        00:50:56:ab:cd:01  Corp-WiFi  ap-floor1  employee  24m  dot1x',
  'show user-table':
    'Users: 1243\nName       IP              MAC               ROLE       Age   AP        11h  Fwd\n-          10.0.50.100     00:50:56:ab:cd:01 employee   24m   ap-floor1  a    -\n-          10.0.50.101     00:50:56:ab:cd:02 employee   8m    ap-floor1  a    -',
  'show user-table verbose':
    'Name       IP              MAC               ROLE       Age   Flags  Auth  BSSID\n-          10.0.50.100     00:50:56:ab:cd:01 employee   24m   RWa    dot1x 00:1a:1e:ab:cd:e0\n  SNR: 36dB  RSSI: -58dBm  Rate: 866M/866M  VLAN: 10  ESI: none',
  'show user mac <mac>':
    'User 00:50:56:ab:cd:01:\n  IP            : 10.0.50.100\n  SSID          : Corp-WiFi\n  AP            : ap-floor1\n  Role          : employee\n  Auth Type     : 802.1X/PEAP\n  Signal        : -58 dBm\n  SNR           : 36 dB\n  TX Rate       : 866 Mbps\n  RX Rate       : 866 Mbps\n  VLAN          : 10\n  Session Time  : 24 minutes',
  'show user ip <ip>':
    'User 10.0.50.100:\n  MAC   : 00:50:56:ab:cd:01\n  SSID  : Corp-WiFi\n  AP    : ap-floor1\n  Role  : employee',
  'show user role <role>':
    'Users with role employee: 1121\n  10.0.50.100  00:50:56:ab:cd:01  ap-floor1\n  10.0.50.101  00:50:56:ab:cd:02  ap-floor1\n  (... 1119 more)',
  'show user-table essid <ssid>':
    'Users on SSID Corp-WiFi: 1101\n  10.0.50.100  00:50:56:ab:cd:01  employee  ap-floor1\n  10.0.50.101  00:50:56:ab:cd:02  employee  ap-floor2',
  'show roaming':
    'Roaming events (last 60 min):\nTime                 MAC               From AP    To AP      SSID       Type\n2026-06-12 09:30:12  00:50:56:ab:cd:01  ap-floor2  ap-floor3  Corp-WiFi  L2\n2026-06-12 09:28:45  00:50:56:ab:cd:03  ap-floor1  ap-floor2  Corp-WiFi  L3',
  'show client-roaming-history mac <mac>':
    'Client 00:50:56:ab:cd:01 roaming history:\nTime                 From AP    To AP      RSSI-from  RSSI-to\n2026-06-12 09:30:12  ap-floor2  ap-floor3  -72 dBm    -58 dBm\n2026-06-12 08:15:44  ap-floor1  ap-floor2  -75 dBm    -61 dBm',
  'aaa user delete mac <mac>':
    '(Client disconnected; will need to re-associate and re-authenticate)',
});

patchSection(awlc['RF / ARM / AirMatch'], {
  'show ap arm rf-summary':
    'AP Name        R0Ch  R0Pwr  R0Util  R1Ch  R1Pwr  R1Util  Clients\nap-floor1      36    17     14%     6     14     32%      20\nap-floor2      40    17      9%     1     14     28%      14\nap-floor3      36    17     16%     11    14     35%      17',
  'show ap arm scan-times':
    'AP Name        Radio  Last Scan Time        Next Scan Time        Interval\nap-floor1      0      2026-06-12 07:00:00   2026-06-13 07:00:00   24h\nap-floor1      1      2026-06-12 07:00:05   2026-06-13 07:00:05   24h',
  'show ap arm history':
    'Time                 AP         Radio  Old Ch  New Ch  Old Pwr  New Pwr  Reason\n2026-06-12 07:14:32  ap-floor1  0      44      36      17       17       Radar (DFS)\n2026-06-11 23:00:00  ap-floor3  1      11      6       15       14       ARM scheduled',
  'show ap arm client-match-history':
    'Time                 Client MAC        From AP    To AP      Band  Reason\n2026-06-12 09:10:22  00:50:56:ab:cd:05  ap-floor1  ap-floor2  5G    SNR improvement (+8dB)',
  'show ap arm client-match-summary':
    'ClientMatch Summary (last 1 hour):\n  Steers attempted : 34\n  Steers accepted  : 29\n  Steers rejected  : 5\n  Avg SNR gain     : 7.2 dB',
  'show ap arm channel-balance':
    'Channel balance (5GHz):\n  Channel 36: 3 APs  CCI Index: 0.12\n  Channel 40: 2 APs  CCI Index: 0.08\n  Channel 44: 2 APs  CCI Index: 0.09\nChannel balance (2.4GHz):\n  Channel 1:  4 APs  CCI Index: 0.24\n  Channel 6:  4 APs  CCI Index: 0.22\n  Channel 11: 3 APs  CCI Index: 0.18',
  'show ap channel ap-name <name>':
    'AP ap-floor1 Channel/Power:\n  Radio 0 (5GHz)  : ch 36, 17 dBm\n  Radio 1 (2.4GHz): ch 6, 14 dBm',
  'show airmatch report ap-name <name>':
    'AirMatch report for ap-floor1:\n  Applied: 2026-06-12 02:00:07\n  Radio 0: ch 36 (score: 92), pwr 17 dBm\n  Radio 1: ch 6 (score: 78), pwr 14 dBm',
  'show airmatch event radar':
    'AirMatch radar events:\nTime                 AP         Radio  Old Ch  New Ch\n2026-06-12 07:14:32  ap-floor1  0      44      36      (DFS triggered)',
});

patchSection(awlc['Authentication / RADIUS'], {
  'show aaa':
    'Authentication Servers:\n  10.0.0.50:1812   (RADIUS, reachable)\n  10.0.0.51:1812   (RADIUS, reachable, standby)\nAccounting Servers:\n  10.0.0.50:1813   (RADIUS, reachable)\nDefault auth failure role: deny-access',
  'show aaa server':
    'Auth Server List\n----------------\nName          Type    IP              Port  Status    Retries  Timeout\nradius-pri    RADIUS  10.0.0.50       1812  ALIVE     3        5s\nradius-sec    RADIUS  10.0.0.51       1812  ALIVE     3        5s',
  'show aaa rad-server-debug':
    'RADIUS server 10.0.0.50:1812 debug counters:\n  Requests Sent     : 84241\n  Accepts Received  : 82918\n  Rejects Received  :  1221\n  Timeouts          :   102\n  Round-trip avg    :    14 ms',
  'show aaa authentication-server radius':
    'RADIUS Server \"radius-pri\" (10.0.0.50):\n  Status          : Up\n  Auth Port       : 1812\n  Acct Port       : 1813\n  NAS IP          : 10.0.0.201\n  Source IP       : 10.0.0.201\n  Retries         : 3\n  Timeout         : 5',
  'show aaa state user mac <mac>':
    'AAA state for 00:50:56:ab:cd:01:\n  State         : Authenticated\n  Auth Method   : 802.1X/PEAP\n  Role          : employee\n  VLAN          : 10\n  Auth Server   : 10.0.0.50\n  Session Start : 2026-06-12 09:18:05\n  Session Age   : 24m',
  'show aaa profile <name>':
    'AAA Profile \"dot1x-profile\":\n  Initial Role         : logon\n  Auth Server Group    : radius-grp\n  Auth Protocol        : 802.1X\n  L2 Auth Fail-Through : disabled',
  'aaa authentication-server radius <name>\n host 10.10.10.50\n key <key>':
    '(RADIUS server configured; verify with "show aaa server")',
});

patchSection(awlc['Cluster (8.x AOS)'], {
  'show lc-cluster group-membership':
    'LC Cluster Group\n  Group ID         : 1\n  Primary MC       : aruba-mc01 (10.0.0.201) [local]\n  Secondary MC     : aruba-mc02 (10.0.0.202)\n  Member count     : 2\n  State            : ACTIVE',
  'show lc-cluster heartbeat':
    'LC Cluster Heartbeat counters:\n  Sent     : 847234\n  Received : 847231\n  Missed   : 3\n  State    : ALIVE',
  'show lc-cluster ap':
    'AP-to-MC cluster mapping:\nAP Name       Active MC      Standby MC     Uptime\nap-floor1     mc01           mc02           47d 12h\nap-floor2     mc01           mc02           47d 12h\nap-floor3     mc02           mc01           47d 12h',
  'show lc-cluster vlan-probe-status':
    'VLAN probe status:\n  VLAN 10  : probed OK (mc01 ↔ mc02)\n  VLAN 20  : probed OK\n  VLAN 99  : probed OK (management)',
  'show ap lms ap-name <name>':
    'AP ap-floor1 LMS info:\n  Active LMS     : 10.0.0.201 (aruba-mc01)\n  Standby LMS    : 10.0.0.202 (aruba-mc02)\n  LMS Preemption : enabled',
});

patchSection(awlc['Mesh'], {
  'show ap mesh active':
    'Active Mesh APs:\nName          Model  IP            Parent      Role    Link Ch  SNR  Rate\nap-roof-mesh1 AP-635 10.0.50.50    ap-roof1    Portal  5G/36    30   144M\nap-parking1   AP-615 10.0.50.51    ap-roof-mesh1 Point 5G/36   26   54M',
  'show ap mesh topology':
    'Mesh Topology (from root):\nap-roof1 (Root)\n  └─ ap-roof-mesh1 (Portal)  SNR:30  Rate:144Mbps  Link:5G ch36\n       └─ ap-parking1 (Point)  SNR:26  Rate:54Mbps  Link:5G ch36',
  'show ap mesh link ap-name <name>':
    'Mesh link for ap-roof-mesh1:\n  Role        : Portal\n  Parent      : ap-roof1\n  Link Band   : 5GHz\n  Link Channel: 36\n  Link Rate   : 144 Mbps\n  SNR         : 30 dB\n  Link Quality: GOOD\n  Path Cost   : 14',
  'show ap mesh neighbors ap-name <name>':
    'Mesh neighbours for ap-roof-mesh1:\nAP Name       MAC               SNR  Rate   Status\nap-roof1      00:1a:1e:12:34:56  30   144M   Parent (active)\nap-roof2      00:1a:1e:12:34:57  22    54M   Neighbour (candidate)',
});

patchSection(awlc['Firewall (PEF) & Roles'], {
  'show acl':
    'ACL List:\nACL Name        Type  Entries\nallow-dhcp-dns  std   3\ndeny-rfc1918    ext   12\nallow-web       ext   4',
  'show acl ace <id>':
    'ACE detail for ACL allow-web (ID 4):\n  Priority  : 1\n  Action    : permit\n  Protocol  : TCP\n  Source    : any\n  Dest      : any\n  Dest Port : 443',
  'show user-table verbose role <role>':
    'Users with role employee: 1121\n  10.0.50.100  00:50:56:ab:cd:01  employee  ap-floor1  dot1x  24m',
  'show rights <role>':
    'Access rights for role employee:\n  Bandwidth contract: none\n  ACLs:\n    employee-acl (in + out)\n    allow-dns (in)\n  VLANs: 10\n  Rate limit: none',
  'show datapath session':
    'Current Sessions: 24841\nFlags: S=SOFT, T=TUNNEL, U=UP, s=STALED\nSrcIP           SPort  DstIP           DPort  Prot Age  Cntr Flags\n10.0.50.100     52341  8.8.8.8         443    T    24   1    Tu\n10.0.50.101     54218  1.1.1.1         443    T    12   1    Tu',
  'show datapath session table | include <ip>':
    '10.0.50.100     52341  8.8.8.8         443    T    24   1    Tu\n10.0.50.100     52342  8.8.8.8         80     T    24   1    Tu',
  'show datapath session counters':
    'Session counters:\n  Current         : 24841\n  Created (total) : 18432441\n  Deleted (total) : 18407600\n  Failed alloc    : 0\n  Max concurrent  : 31244',
});

patchSection(awlc['Logging & Diagnostics'], {
  'show log all 50':
    'Jun 12 09:42:15 aruba-mc01 stm[1234]: <305012> <WARN> |AP ap-floor1| ARM: ch 44→36 (DFS radar)\nJun 12 09:41:22 aruba-mc01 authmgr[1234]: <132076> <INFO> MAC 00:50:56:ab:cd:01 authenticated via 802.1X\nJun 12 09:40:44 aruba-mc01 fpapps[1234]: <501178> <INFO> SNMP trap sent to 10.0.0.60',
  'show log security 50':
    'Jun 12 09:42:11 aruba-mc01 authmgr: <132074> <WARN> User 10.0.50.99 failed 802.1X authentication (3rd attempt)\nJun 12 09:40:22 aruba-mc01 authmgr: <132076> <INFO> User 10.0.50.100 authenticated, role employee assigned',
  'show log user-debug 50':
    'Jun 12 09:41:22 aruba-mc01 authmgr: <132076> User 00:50:56:ab:cd:01 authenticated, role=employee, VLAN=10\nJun 12 09:41:23 aruba-mc01 fpapps: <501001> User 10.0.50.100 session created',
  'show log system 50':
    'Jun 12 09:30:00 aruba-mc01 sysmgr: <100032> Corosync heartbeat OK\nJun 12 09:00:00 aruba-mc01 sapd: <125088> AP ap-floor1 Up (10.0.50.11)',
  'show log errorlog 50':
    'Jun 12 03:14:32 aruba-mc01 stm: <305088> AP ap-floor5 Down (timeout)\nJun 12 03:14:40 aruba-mc01 stm: <305012> AP ap-floor5 Up (reconnected)',
  'logging arm-user':
    '(ARM per-user logging enabled; see "show log user-debug" for output)',
  'logging level debugging user mac <mac>':
    '(Debug-level logging enabled for MAC 00:50:56:ab:cd:01; check "show log user-debug")',
  'show ap remote debug client-trace ap-name <name>':
    'Client trace for ap-floor1:\n  2026-06-12 09:41:22  00:50:56:ab:cd:01  ASSOC-REQ  radio0  ch36  -58dBm\n  2026-06-12 09:41:22  00:50:56:ab:cd:01  ASSOC-RSP  success\n  2026-06-12 09:41:23  00:50:56:ab:cd:01  EAP-START\n  2026-06-12 09:41:24  00:50:56:ab:cd:01  EAP-SUCCESS',
  'show tech-support':
    '### show version ###\nArubaOS 8.11.2.2 ...\n### show ap database ###\n...\n(Full diagnostic bundle for TAC; output several MB)',
  'show tech-support | include error':
    'stm[1234]: <305088> ERROR AP ap-floor5 Down\nauthmgr[1234]: <132074> ERROR 802.1X auth failed for 10.0.50.99',
});

patchSection(awlc['Config Management'], {
  'write memory':
    'Saving Configuration...\nSaved.',
  'copy running-config flash:bkp.cfg':
    'Configuration saved to flash:bkp.cfg',
  'copy flash:bkp.cfg tftp 10.50.50.50 bkp.cfg':
    'Copying flash:bkp.cfg to tftp://10.50.50.50/bkp.cfg...\n.........\nTransfer complete.',
  'show image version':
    'Partition 0: ArubaOS 8.11.2.2 (active)\nPartition 1: ArubaOS 8.10.0.8\nBooted from: Partition 0',
  'copy ftp 10.50.50.50 admin <pwd> arubaos.ari system: partition 1':
    'Downloading image from ftp://10.50.50.50/arubaos.ari to partition 1\n[####################################] 100%\nImage installed in partition 1',
  'reload':
    'Do you really want to reset the system(y/n)?\nSystem will reload now...',
  'reload at 02:00':
    'Reload scheduled at 02:00\nUse "no reload at" to cancel.',
});

// Add 1 new Aruba WLC command
addNewCmds(awlc['AP Management'], [
  {
    cmd: 'show ap monitor ap-list ap-name <name>',
    desc: 'Detected APs (neighbours + rogues) seen by this AP in monitor mode',
    type: 'show',
    flagged: false,
    example: 'Detected APs by ap-floor1:\nBSSID              SSID              Ch  Signal  Type   Enc  Last Seen\n00:11:22:33:44:55  Corp-WiFi         36  -62dBm  Valid  WPA3 Jun 12 09:42\naa:bb:cc:dd:ee:ff  FreeWiFi          6   -78dBm  Rogue  None Jun 12 09:41\n66:77:88:99:aa:bb  NeighbourBiz      11  -84dBm  Ext    WPA2 Jun 12 09:40',
  },
]);

// ─────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────
writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Part 2 done: AWS + Aruba AP + Aruba WLC patched');
