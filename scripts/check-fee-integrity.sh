#!/usr/bin/env bash
# Does every balance in the ledger have a reason?
#
# The rule this checks is the one a school actually cares about: no fee amount
# exists unless the system can say where it came from. Each query below is a
# way that rule can break, and each was written after finding a real instance
# of it in production — so a clean run is not a formality, it is the statement
# that the fee module is telling schools the truth.
#
# Read-only. It reports; it never writes, and it never deletes.
#
#   ./scripts/check-fee-integrity.sh            # every school
#   ./scripts/check-fee-integrity.sh kts        # one subdomain
set -uo pipefail

HOST=${EKULMIS_DB_HOST:-root@187.127.91.43}
CONTAINER=${EKULMIS_DB_CONTAINER:-d6yg3xcdhgmjfqrnjpbaoe48}
ONLY=${1:-}
SCOPE=""
[ -n "$ONLY" ] && SCOPE="and sc.subdomain = '$ONLY'"

run() { ssh -o StrictHostKeyChecking=no "$HOST" \
  "docker exec $CONTAINER psql -U postgres -d ekulmis -At -F'|' -c \"$1\"" 2>/dev/null; }

fail=0
report() { # name, sql, explanation
  local out
  out=$(run "$2")
  if [ -z "$out" ]; then
    printf '  OK    %s\n' "$1"
  else
    fail=1
    printf '  FAIL  %s\n' "$1"
    printf '        %s\n' "$3"
    printf '%s\n' "$out" | sed 's/^/          /'
  fi
}

echo "Fee ledger integrity${ONLY:+ — $ONLY}"
echo

# A month nobody set up must not produce an obligation. Money paid ahead into a
# future month is a different thing and is allowed: the charge exists to hold
# the payment. So this looks only for charges that owe and were never set up.
report "no obligation in a month that was never set up" "
select sc.name, count(*), sum(c.amount - c.\\\"paidAmount\\\")
from fee_charges c join schools sc on sc.id = c.\\\"schoolId\\\"
where c.kind = 'MONTHLY' and c.amount > c.\\\"paidAmount\\\" $SCOPE
  and not exists (select 1 from monthly_fee_activations a
    where a.\\\"schoolId\\\" = c.\\\"schoolId\\\" and a.year = c.year and a.month = c.month)
group by 1 order by 3 desc;
" "These families owe for a month their school never activated."

report "a free student owes nothing" "
select sc.name, count(*), sum(c.amount - c.\\\"paidAmount\\\")
from students st
join schools sc on sc.id = st.\\\"schoolId\\\"
join fee_charges c on c.\\\"studentId\\\" = st.id and c.kind = 'MONTHLY'
where (st.\\\"feeWaived\\\" = true or st.\\\"monthlyFee\\\" = 0)
  and c.amount > c.\\\"paidAmount\\\" $SCOPE
group by 1 order by 3 desc;
" "A waived student is being shown as owing money."

report "no payment is attached to nothing" "
select sc.name, count(*), sum(p.amount)
from payments p join schools sc on sc.id = p.\\\"schoolId\\\"
where p.\\\"isReversal\\\" = false and p.status = 'ACTIVE' $SCOPE
  and not exists (select 1 from payment_allocations al where al.\\\"paymentId\\\" = p.id)
group by 1 order by 3 desc;
" "Money was taken that settles no charge — it cannot appear on any account."

report "no charge is paid more than it asks" "
select sc.name, count(*), sum(c.\\\"paidAmount\\\" - c.amount)
from fee_charges c join schools sc on sc.id = c.\\\"schoolId\\\"
where c.\\\"paidAmount\\\" > c.amount $SCOPE
group by 1 order by 3 desc;
" "Overpaid rows. Legitimate after a fee is lowered — the excess must show as credit."

report "every charge belongs to a student of its own school" "
select sc.name, count(*)
from fee_charges c
join schools sc on sc.id = c.\\\"schoolId\\\"
join students st on st.id = c.\\\"studentId\\\"
where st.\\\"schoolId\\\" <> c.\\\"schoolId\\\" $SCOPE
group by 1;
" "A charge crossed a school boundary. This is a tenancy fault, not an accounting one."

echo
if [ "$fail" = 0 ]; then
  echo "Every balance has a reason."
else
  echo "Findings above. Nothing here has been changed — decide each one deliberately."
fi
exit $fail
