#!/usr/bin/env bash
# Read-only AWS capability + posture probe for staging.
# Uses whatever credentials are already in the environment (never creates or changes keys).
# Output is ONLY classified RESULT_* lines: GitHub Actions logs for this repo are public,
# so no ARNs, account IDs, key IDs, hostnames or raw AWS error text are printed.
#
# Env: AWS_DEFAULT_REGION (default us-east-2), optional DB_HOST (Aurora endpoint),
#      optional EC2_INSTANCE_ID or EC2_PUBLIC_IP (staging API host).
set -u
REGION="${AWS_DEFAULT_REGION:-us-east-2}"
DB_HOST="${DB_HOST:-}"
q() { aws --region "$REGION" --output text "$@" 2>/dev/null; }
yn() { if aws --region "$REGION" "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }

ARN=$(q sts get-caller-identity --query Arn || true)
if [ -z "$ARN" ]; then echo "RESULT_AUTH=no"; exit 0; fi
echo "RESULT_AUTH=yes"
case "$ARN" in
  *:user/*) echo "RESULT_PRINCIPAL=iam_user"; SIM="$ARN" ;;
  *:assumed-role/*)
    echo "RESULT_PRINCIPAL=role"
    SIM=$(printf '%s' "$ARN" | sed -E 's|^arn:aws:sts::([0-9]+):assumed-role/([^/]+)/.*$|arn:aws:iam::\1:role/\2|') ;;
  *:root) echo "RESULT_PRINCIPAL=root"; SIM="" ;;
  *) echo "RESULT_PRINCIPAL=other"; SIM="" ;;
esac

echo "RESULT_READ_RDS=$(yn rds describe-db-clusters --max-records 20)"
echo "RESULT_READ_EC2=$(yn ec2 describe-instances --max-results 5)"
echo "RESULT_READ_SECRETS=$(yn secretsmanager list-secrets --max-results 1)"
echo "RESULT_READ_IAM=$(yn iam list-roles --max-items 1)"
echo "RESULT_READ_WAF=$(yn wafv2 list-web-acls --scope REGIONAL)"

# --- Aurora posture ---
CID=""
if [ -n "$DB_HOST" ]; then
  CID=$(q rds describe-db-clusters --query "DBClusters[?Endpoint=='$DB_HOST' || ReaderEndpoint=='$DB_HOST'] | [0].DBClusterIdentifier" || true)
  if [ -z "$CID" ] || [ "$CID" = "None" ]; then
    CID=$(q rds describe-db-instances --query "DBInstances[?Endpoint.Address=='$DB_HOST'] | [0].DBClusterIdentifier" || true)
  fi
fi
if [ -z "$CID" ] || [ "$CID" = "None" ]; then
  N=$(q rds describe-db-clusters --query 'length(DBClusters)' || echo 0)
  echo "RESULT_CLUSTER_COUNT=${N:-0}"
  [ "${N:-0}" = "1" ] && CID=$(q rds describe-db-clusters --query 'DBClusters[0].DBClusterIdentifier' || true)
fi
if [ -n "$CID" ] && [ "$CID" != "None" ]; then
  echo "RESULT_CLUSTER_FOUND=yes"
  row() { q rds describe-db-clusters --db-cluster-identifier "$CID" --query "DBClusters[0].$1" || true; }
  echo "RESULT_STORAGE_ENCRYPTED=$(row StorageEncrypted | tr 'A-Z' 'a-z')"
  KMS=$(row KmsKeyId)
  if [ -n "$KMS" ] && [ "$KMS" != "None" ]; then
    MGR=$(q kms describe-key --key-id "$KMS" --query KeyMetadata.KeyManager || true)
    echo "RESULT_KMS_KEY_MANAGER=$(printf '%s' "${MGR:-unknown}" | tr 'A-Z' 'a-z')"
  fi
  echo "RESULT_BACKUP_RETENTION_DAYS=$(row BackupRetentionPeriod)"
  echo "RESULT_DELETION_PROTECTION=$(row DeletionProtection | tr 'A-Z' 'a-z')"
  echo "RESULT_ENGINE_VERSION=$(row EngineVersion)"
  PG=$(row DBClusterParameterGroup)
  case "$PG" in default.*) echo "RESULT_PARAM_GROUP=default" ;; "") echo "RESULT_PARAM_GROUP=unknown" ;; *) echo "RESULT_PARAM_GROUP=custom" ;; esac
  if [ -n "$PG" ]; then
    SPL=$(q rds describe-db-cluster-parameters --db-cluster-parameter-group-name "$PG" \
      --query "Parameters[?ParameterName=='shared_preload_libraries'].ParameterValue | [0]" || true)
    case "$SPL" in *pgaudit*) echo "RESULT_PGAUDIT_PRELOADED=yes" ;; *) echo "RESULT_PGAUDIT_PRELOADED=no" ;; esac
  fi
  case "$(row 'EnabledCloudwatchLogsExports')" in *postgresql*) echo "RESULT_LOG_EXPORT=yes" ;; *) echo "RESULT_LOG_EXPORT=no" ;; esac
  PUB=$(q rds describe-db-instances --filters "Name=db-cluster-id,Values=$CID" --query 'DBInstances[?PubliclyAccessible==`true`] | length(@)' || echo "?")
  echo "RESULT_DB_INSTANCES_PUBLIC=$PUB"
  SGS=$(row 'VpcSecurityGroups[].VpcSecurityGroupId')
  if [ -n "$SGS" ] && [ "$SGS" != "None" ]; then
    # shellcheck disable=SC2086
    OPEN=$(q ec2 describe-security-groups --group-ids $SGS \
      --query "SecurityGroups[].IpPermissions[?(FromPort<=\`5432\` && ToPort>=\`5432\`) || IpProtocol=='-1'][].IpRanges[?CidrIp=='0.0.0.0/0'][] | length(@)" || echo "?")
    echo "RESULT_DB_SG_WORLD_5432=$OPEN"
  fi
else
  echo "RESULT_CLUSTER_FOUND=no"
fi

# --- Staging EC2 host ---
IID="${EC2_INSTANCE_ID:-}"
if [ -z "$IID" ] && [ -n "${EC2_PUBLIC_IP:-}" ]; then
  IID=$(q ec2 describe-instances --filters "Name=ip-address,Values=$EC2_PUBLIC_IP" --query 'Reservations[0].Instances[0].InstanceId' || true)
fi
if [ -n "$IID" ] && [ "$IID" != "None" ]; then
  PROF=$(q ec2 describe-instances --instance-ids "$IID" --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' || true)
  if [ -z "$PROF" ]; then echo "RESULT_EC2_PROFILE=unknown"
  elif [ "$PROF" = "None" ]; then echo "RESULT_EC2_PROFILE=none"
  else echo "RESULT_EC2_PROFILE=attached"; fi
fi

# --- Write permissions (policy simulation only; nothing is changed) ---
if [ -n "$SIM" ]; then
  for a in iam:CreateRole iam:PutRolePolicy iam:CreateInstanceProfile iam:AddRoleToInstanceProfile iam:PassRole \
           ec2:AssociateIamInstanceProfile \
           rds:CreateDBClusterParameterGroup rds:ModifyDBClusterParameterGroup rds:ModifyDBCluster rds:RebootDBInstance \
           rds:RestoreDBClusterToPointInTime rds:CreateDBInstance rds:DeleteDBInstance rds:DeleteDBCluster \
           secretsmanager:CreateSecret secretsmanager:PutSecretValue \
           wafv2:CreateWebACL cloudfront:CreateDistribution; do
    D=$(q iam simulate-principal-policy --policy-source-arn "$SIM" --action-names "$a" \
      --query 'EvaluationResults[0].EvalDecision' || true)
    case "$D" in allowed) v=allowed ;; *Deny*|*deny*) v=denied ;; *) v=unknown ;; esac
    echo "RESULT_CAN_$(printf '%s' "$a" | tr ':' '_')=$v"
  done
fi
