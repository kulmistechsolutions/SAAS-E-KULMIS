#!/bin/bash
#
# eKulmis host monitor — run by cron every 5 minutes:
#   */5 * * * * /root/ekulmis-health.sh
#
# Writes one row to system_health_checks, which Super Admin → System Health
# reads. It runs on the host, outside the app, so it still reports when the
# API or website is down. When the whole server is off nothing can report;
# the gap between rows is how that outage shows up afterwards.

set -u
exec 9>/var/lock/ekulmis-health.lock
flock -n 9 || exit 0   # never let two runs overlap

PG=d6yg3xcdhgmjfqrnjpbaoe48
DB=ekulmis
API_C=vnhb3wqjnrnw83g3jexdwr62
WEB_C=ha2c4vgfshlnfpioa1ia3ww1
LOG=/var/log/ekulmis-health.log

psqlq() { docker exec "$PG" psql -U postgres -d "$DB" -At -c "$1" 2>/dev/null; }
to_ms() { awk -v t="$1" 'BEGIN { printf "%d", t * 1000 }'; }
problems=()

# ── API and website ─────────────────────────────────────────────────────────
r=$(curl -s -o /dev/null -m 15 -w "%{http_code} %{time_total}" \
  -H "x-tenant-subdomain: kts" https://api.ekulmis.com/api/settings/branding)
api_code=${r% *}; api_ms=$(to_ms "${r#* }")
if [ "$api_code" != "200" ]; then problems+=("API not answering (HTTP $api_code)")
elif [ "$api_ms" -gt 3000 ]; then problems+=("API slow (${api_ms}ms)"); fi

r=$(curl -s -o /dev/null -m 15 -w "%{http_code} %{time_total}" https://kts.ekulmis.com/login)
web_code=${r% *}; web_ms=$(to_ms "${r#* }")
if [ "$web_code" != "200" ]; then problems+=("Website not loading (HTTP $web_code)")
elif [ "$web_ms" -gt 3000 ]; then problems+=("Website slow (${web_ms}ms)"); fi

# ── Database ────────────────────────────────────────────────────────────────
t0=$(date +%s%N)
if psqlq "select 1" >/dev/null && [ -n "$(psqlq 'select 1')" ]; then db_ok=1; else db_ok=0; fi
db_ms=$(( ($(date +%s%N) - t0) / 1000000 ))
[ "$db_ok" = 0 ] && problems+=("Database not answering")

# ── Every school's site, ten at a time ──────────────────────────────────────
subs=$(psqlq "select subdomain from schools order by 1")
sites_checked=$(printf "%s\n" "$subs" | grep -c .)
failed=$(printf "%s\n" "$subs" | grep . | xargs -P 10 -I{} sh -c \
  'c=$(curl -s -o /dev/null -m 15 -w "%{http_code}" https://{}.ekulmis.com/login); [ "$c" = 200 ] || echo "{}($c)"' | sort | tr '\n' ',' | sed 's/,$//')
sites_failed=$( [ -n "$failed" ] && echo "$failed" | tr ',' '\n' | grep -c . || echo 0 )
[ "$sites_failed" -gt 0 ] && problems+=("$sites_failed school site(s) not loading")

# ── The machine ─────────────────────────────────────────────────────────────
disk_pct=$(df --output=pcent / | tail -1 | tr -dc 0-9)
[ "$disk_pct" -ge 85 ] && problems+=("Disk ${disk_pct}% full")
mem_avail=$(free -m | awk '/^Mem:/ { print $7 }')
[ "$mem_avail" -lt 500 ] && problems+=("Low memory (${mem_avail} MB free)")
load1=$(cut -d' ' -f1 /proc/loadavg)
cores=$(nproc)
awk -v l="$load1" -v c="$cores" 'BEGIN { exit !(l > c * 2) }' && problems+=("High load ($load1 on $cores cores)")
booted_at=$(uptime -s)

containers_down=""
for name in "$API_C" "$WEB_C" "$PG"; do
  st=$(docker ps --format '{{.Names}} {{.Status}}' | grep "^$name" | head -1)
  case "$st" in
    *unhealthy*|"") containers_down="$containers_down $name" ;;
  esac
done
containers_down=$(echo "$containers_down" | xargs)
[ -n "$containers_down" ] && problems+=("Container down: $containers_down")

# ── Errors and backups ──────────────────────────────────────────────────────
errors_1h=$(psqlq "select count(*) from error_logs where \"createdAt\" > now() - interval '1 hour'")
errors_1h=${errors_1h:-0}
[ "$errors_1h" -ge 5 ] && problems+=("$errors_1h server errors in the last hour")

newest=$(ls -t /root/backups/*.dump 2>/dev/null | head -1)
if [ -n "$newest" ]; then
  backup_age=$(awk -v n="$(date +%s)" -v m="$(stat -c %Y "$newest")" 'BEGIN { printf "%.1f", (n - m) / 3600 }')
  awk -v a="$backup_age" 'BEGIN { exit !(a > 26) }' && problems+=("Last backup ${backup_age}h ago")
else
  backup_age="NULL"; problems+=("No database backup found")
fi

# ── Record ──────────────────────────────────────────────────────────────────
ok=true; [ ${#problems[@]} -gt 0 ] && ok=false
problems_text=$(IFS=';'; echo "${problems[*]:-}" | sed "s/'/''/g")
sql_text() { [ -n "$1" ] && echo "'$(echo "$1" | sed "s/'/''/g" | cut -c1-1000)'" || echo NULL; }
id="hc$(date +%s%N | sha1sum | cut -c1-22)"

psqlq "INSERT INTO system_health_checks
  (id, \"checkedAt\", ok, \"apiMs\", \"webMs\", \"dbMs\", \"sitesChecked\", \"sitesFailed\", \"failedSites\",
   \"diskPct\", \"memAvailableMb\", load1, \"bootedAt\", \"containersDown\", \"errors1h\", \"backupAgeHours\", problems)
  VALUES ('$id', now(), $ok, $api_ms, $web_ms, $db_ms, ${sites_checked:-0}, ${sites_failed:-0}, $(sql_text "$failed"),
   ${disk_pct:-NULL}, ${mem_avail:-NULL}, ${load1:-NULL}, '$booted_at', $(sql_text "$containers_down"),
   $errors_1h, $backup_age, $(sql_text "$problems_text"));
  DELETE FROM system_health_checks WHERE \"checkedAt\" < now() - interval '30 days';" >/dev/null \
  || echo "$(date -u '+%F %T') could not record: ok=$ok $problems_text" >> "$LOG"

echo "$(date -u '+%F %T') ok=$ok api=${api_ms}ms web=${web_ms}ms db=${db_ms}ms sites=${sites_checked}/${sites_failed} disk=${disk_pct}% mem=${mem_avail}MB ${problems_text}" >> "$LOG"
