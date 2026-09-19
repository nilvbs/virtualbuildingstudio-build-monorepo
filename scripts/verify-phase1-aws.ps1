<#
.SYNOPSIS
  Phase 1 AWS checks from SECURITY.html — Aurora encryption, private subnets, SG, secrets.

.DESCRIPTION
  Requires AWS CLI configured (aws configure or env credentials).
  Usage:
    pwsh ./scripts/verify-phase1-aws.ps1
    pwsh ./scripts/verify-phase1-aws.ps1 -Region us-east-2 -ClusterId my-aurora-cluster

  Optional env:
    AWS_REGION, BLD_AURORA_CLUSTER_ID, BLD_RDS_PROXY_NAME
#>
param(
  [string]$Region = $env:AWS_REGION,
  [string]$ClusterId = $env:BLD_AURORA_CLUSTER_ID,
  [string]$ProxyName = $env:BLD_RDS_PROXY_NAME
)

$ErrorActionPreference = 'Stop'

function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FAIL $msg" -ForegroundColor Red; $script:failed++ }
function Info($msg) { Write-Host "  ..  $msg" -ForegroundColor DarkGray }

$script:failed = 0

Write-Host "`n=== BLD Phase 1 AWS verification ===`n"

try {
  $identityRaw = aws sts get-caller-identity --output json 2>&1
  if ($LASTEXITCODE -ne 0) { throw $identityRaw }
  $identity = $identityRaw | ConvertFrom-Json
  if (-not $identity.Account) { throw 'Empty identity' }
  Ok "Authenticated as $($identity.Arn) (account $($identity.Account))"
} catch {
  Bad "AWS CLI not authenticated. Run one of:"
  Write-Host "       aws configure"
  Write-Host "       aws login"
  Write-Host "       # or set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION"
  Write-Host ""
  exit 1
}

if (-not $Region) {
  $Region = aws configure get region 2>$null
}
if (-not $Region) {
  Bad "No region. Pass -Region us-east-2 or set AWS_REGION"
  exit 1
}
Ok "Region: $Region"

# --- Secrets Manager ---
Write-Host "`n-- Secrets Manager (bld/api/*) --"
$secretNames = @(
  'bld/api/DATABASE_URL',
  'bld/api/DIRECT_DATABASE_URL',
  'bld/api/CORS_ORIGINS',
  'bld/api/WEB_APP_URL'
)
foreach ($name in $secretNames) {
  try {
    $raw = aws secretsmanager get-secret-value --region $Region --secret-id $name --query SecretString --output text 2>$null
    if (-not $raw) { Bad "$name missing or empty"; continue }
    if ($name -match 'DATABASE') {
      if ($raw -match 'sslmode=(require|verify-ca|verify-full)' -or $raw -match '[?&]ssl=true') {
        Ok "$name present + SSL"
      } else {
        Bad "$name present but missing sslmode=require (or verify-ca/full)"
      }
    } else {
      Ok "$name = $raw"
    }
  } catch {
    Bad "$name not found in Secrets Manager ($Region)"
  }
}

# --- Aurora clusters ---
Write-Host "`n-- Aurora / RDS --"
try {
  $clustersJson = aws rds describe-db-clusters --region $Region --output json | ConvertFrom-Json
  $clusters = @($clustersJson.DBClusters)
  if ($clusters.Count -eq 0) {
    Info "No Aurora/RDS clusters in $Region (staging may still be EC2+local Postgres)."
  } else {
    if ($ClusterId) {
      $clusters = @($clusters | Where-Object { $_.DBClusterIdentifier -eq $ClusterId })
      if ($clusters.Count -eq 0) { Bad "Cluster $ClusterId not found" }
    }
    foreach ($c in $clusters) {
      Write-Host "  Cluster: $($c.DBClusterIdentifier)"
      if ($c.StorageEncrypted) { Ok "Storage encrypted (KMS: $($c.KmsKeyId))" }
      else { Bad "$($c.DBClusterIdentifier) storage NOT encrypted" }

      $pub = $c.PubliclyAccessible
      # Cluster-level PubliclyAccessible may be null; check instances
      $inst = aws rds describe-db-instances --region $Region --filters "Name=db-cluster-id,Values=$($c.DBClusterIdentifier)" --output json | ConvertFrom-Json
      foreach ($i in @($inst.DBInstances)) {
        if ($i.PubliclyAccessible) { Bad "Instance $($i.DBInstanceIdentifier) is publicly accessible" }
        else { Ok "Instance $($i.DBInstanceIdentifier) not publicly accessible" }

        $subnetGroup = $i.DBSubnetGroup
        if ($subnetGroup) {
          Ok "Subnet group: $($subnetGroup.DBSubnetGroupName) ($($subnetGroup.Subnets.Count) subnets)"
          foreach ($s in $subnetGroup.Subnets) {
            Info "subnet $($s.SubnetIdentifier) az=$($s.SubnetAvailabilityZone.Name)"
          }
        }

        foreach ($sgId in @($i.VpcSecurityGroups.VpcSecurityGroupId)) {
          $sg = aws ec2 describe-security-groups --region $Region --group-ids $sgId --output json | ConvertFrom-Json
          $g = $sg.SecurityGroups[0]
          Write-Host "  SG $($g.GroupId) ($($g.GroupName))"
          $openWorld = $false
          foreach ($perm in @($g.IpPermissions)) {
            $from = if ($null -eq $perm.FromPort) { '*' } else { $perm.FromPort }
            $to = if ($null -eq $perm.ToPort) { '*' } else { $perm.ToPort }
            $cidrs = @($perm.IpRanges | ForEach-Object { $_.CidrIp })
            $refs = @($perm.UserIdGroupPairs | ForEach-Object { $_.GroupId })
            Info "ingress $from-$to cidrs=[$($cidrs -join ',')] sgs=[$($refs -join ',')]"
            if ($from -eq 5432 -or $to -eq 5432 -or $from -eq '*') {
              if ($cidrs -contains '0.0.0.0/0' -or $cidrs -contains '::/0') { $openWorld = $true }
            }
          }
          if ($openWorld) { Bad "SG $($g.GroupId) allows 5432 from the world (0.0.0.0/0)" }
          else { Ok "SG $($g.GroupId) does not open 5432 to the world" }
        }
      }
    }
  }
} catch {
  Bad "RDS describe failed: $($_.Exception.Message)"
}

# --- RDS Proxy (optional) ---
if ($ProxyName) {
  Write-Host "`n-- RDS Proxy $ProxyName --"
  try {
    $proxy = aws rds describe-db-proxies --region $Region --db-proxy-name $ProxyName --output json | ConvertFrom-Json
    Ok "Proxy $($proxy.DBProxies[0].DBProxyName) status=$($proxy.DBProxies[0].Status)"
  } catch {
    Bad "Proxy $ProxyName not found"
  }
}

Write-Host "`n=== Summary: $script:failed failure(s) ===`n"
if ($script:failed -gt 0) { exit 1 }
exit 0
