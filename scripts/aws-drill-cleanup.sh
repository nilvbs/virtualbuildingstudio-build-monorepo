#!/usr/bin/env bash
# Delete every throwaway Aurora restore-drill copy (bld-restore-drill-*) and confirm it is gone.
# Only ever touches identifiers with that prefix. Prints RESULT_* lines; identifiers are masked.
set -uo pipefail

PREFIX=bld-restore-drill-

list_clusters() {
  aws rds describe-db-clusters \
    --query "DBClusters[?starts_with(DBClusterIdentifier, '${PREFIX}')].DBClusterIdentifier" \
    --output text 2>/dev/null | tr '\t' '\n' | grep -E "^${PREFIX}" || true
}
list_instances() {
  aws rds describe-db-instances \
    --query "DBInstances[?starts_with(DBInstanceIdentifier, '${PREFIX}')].DBInstanceIdentifier" \
    --output text 2>/dev/null | tr '\t' '\n' | grep -E "^${PREFIX}" || true
}

CLUSTERS=$(list_clusters)
INSTANCES=$(list_instances)
echo "RESULT_DRILL_LEFTOVER_CLUSTERS=$(printf '%s' "$CLUSTERS" | grep -c . || true)"
echo "RESULT_DRILL_LEFTOVER_INSTANCES=$(printf '%s' "$INSTANCES" | grep -c . || true)"

for I in $INSTANCES; do
  echo "::add-mask::$I"
  ERR=$(aws rds delete-db-instance --db-instance-identifier "$I" 2>&1 >/dev/null) || {
    printf '%s' "$ERR" | grep -q 'InvalidDBInstanceState\|DBInstanceNotFound' ||
      echo "::warning title=Drill cleanup::delete instance $(printf '%s' "$ERR" | grep -oE '\([A-Za-z]+\)' | head -1)"
  }
done
for I in $INSTANCES; do aws rds wait db-instance-deleted --db-instance-identifier "$I" 2>/dev/null || true; done

for C in $CLUSTERS; do
  echo "::add-mask::$C"
  ERR=$(aws rds delete-db-cluster --db-cluster-identifier "$C" --skip-final-snapshot 2>&1 >/dev/null) || {
    printf '%s' "$ERR" | grep -q 'InvalidDBClusterStateFault\|DBClusterNotFoundFault' ||
      echo "::warning title=Drill cleanup::delete cluster $(printf '%s' "$ERR" | grep -oE '\([A-Za-z]+\)' | head -1)"
  }
done

# Cluster deletion is async; wait up to ~20 min for all drill clusters to disappear.
for _ in $(seq 1 40); do
  [ -z "$(list_clusters)$(list_instances)" ] && break
  sleep 30
done

LEFT=$(( $(list_clusters | grep -c . || true) + $(list_instances | grep -c . || true) ))
if [ "$LEFT" -eq 0 ]; then
  echo "RESULT_DRILL_CLEANUP=deleted"
else
  echo "RESULT_DRILL_CLEANUP=still_present_$LEFT"
  exit 1
fi
