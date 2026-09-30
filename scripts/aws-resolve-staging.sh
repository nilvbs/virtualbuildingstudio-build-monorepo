#!/usr/bin/env bash
# Resolve the staging Aurora cluster and EC2 instance without printing identifiers
# (Actions logs are public). Matches the SHA-256 of the Aurora host that the EC2 box
# reports against RDS endpoints, and the EC2 public IP against running instances.
# In:  DBHOST_SHA, EC2_HOST (IP or DNS name), AWS credentials in env.
# Out: BLD_CID, BLD_DB_HOST, BLD_IID appended to $GITHUB_ENV (all masked).
set -euo pipefail
sha() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }

CID=""
DB_HOST=""
while read -r cid ep rep; do
  for e in "$ep" "$rep"; do
    if [ -n "$e" ] && [ "$(sha "$e")" = "${DBHOST_SHA:-}" ]; then CID="$cid"; DB_HOST="$e"; fi
  done
done < <(aws rds describe-db-clusters --query 'DBClusters[].[DBClusterIdentifier,Endpoint,ReaderEndpoint]' --output text 2>/dev/null || true)
if [ -z "$CID" ]; then
  while read -r cid ep; do
    if [ -n "$ep" ] && [ "$(sha "$ep")" = "${DBHOST_SHA:-}" ]; then CID="$cid"; DB_HOST="$ep"; fi
  done < <(aws rds describe-db-instances --query 'DBInstances[].[DBClusterIdentifier,Endpoint.Address]' --output text 2>/dev/null || true)
fi

IP="${EC2_HOST:-}"
if [ -n "$IP" ] && ! [[ "$IP" =~ ^[0-9.]+$ ]]; then
  IP=$(getent hosts "$IP" | awk '{ print $1; exit }' || true)
fi
IID=""
if [ -n "$IP" ]; then
  IID=$(aws ec2 describe-instances --filters "Name=ip-address,Values=$IP" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)
  [ "$IID" = "None" ] && IID=""
fi

for v in "$CID" "$DB_HOST" "$IID"; do
  if [ -n "$v" ]; then echo "::add-mask::$v"; fi
done
{
  echo "BLD_CID=$CID"
  echo "BLD_DB_HOST=$DB_HOST"
  echo "BLD_IID=$IID"
} >> "$GITHUB_ENV"
echo "RESULT_CLUSTER_RESOLVED=$([ -n "$CID" ] && echo yes || echo no)"
echo "RESULT_EC2_RESOLVED=$([ -n "$IID" ] && echo yes || echo no)"
