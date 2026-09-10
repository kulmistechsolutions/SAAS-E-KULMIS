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

# The opposite fault to the first rule, and the quieter one: a month a school
# did set up that never reached a student who should have been billed. It costs
# the school money rather than the family, so nobody complains and it is only
# ever found by asking. Registration raises a student's fees in a try/catch
# that logged a warning and moved on, which is one way to arrive here.
#
# Months before the student existed are excluded, as are students whose billing
# was deliberately set to start later.
report "a billed month reached every student it should" "
select sc.name, count(*), min(a.year * 100 + a.month), max(a.year * 100 + a.month)
from students st
join schools sc on sc.id = st.\\\"schoolId\\\"
join monthly_fee_activations a
  on a.\\\"schoolId\\\" = st.\\\"schoolId\\\" and a.\\\"classId\\\" = st.\\\"classId\\\"
where st.status = 'ACTIVE' and st.\\\"monthlyFee\\\" > 0
  and st.\\\"feeWaived\\\" = false $SCOPE
  and (st.\\\"feeBillingStartYear\\\" is null
       or (a.year * 100 + a.month) >=
          (st.\\\"feeBillingStartYear\\\" * 100 + st.\\\"feeBillingStartMonth\\\"))
  and (a.year * 100 + a.month) >=
      (extract(year from st.\\\"createdAt\\\") * 100 + extract(month from st.\\\"createdAt\\\"))
  and not exists (select 1 from fee_charges c
    where c.\\\"studentId\\\" = st.id and c.kind = 'MONTHLY'
      and c.year = a.year and c.month = a.month)
group by 1 order by 2 desc;
" "These students were never billed for a month their class was set up for."

# The live month must be billed at what the student is actually set to pay.
#
# This is the fault that showed as "$7.00 monthly fee, $0.00 outstanding,
# Unpaid" on Haldoor's collect screen: a student moved off free kept the $0
# charge raised while she was free, because the recalculation measured against
# the latest month the *school* had set up rather than her own class's. Her
# class was still on September; the school had already opened October for its
# senior classes.
#
# Only the class's own live month is checked. An older month was correctly
# billed at the rate in force then, and repricing history would invent debt.
report "the live month is billed at the student's own fee" "
select sc.name, count(*), sum(st.\\\"monthlyFee\\\" - c.amount)
from students st
join schools sc on sc.id = st.\\\"schoolId\\\"
join lateral (
  select a.year, a.month from monthly_fee_activations a
  where a.\\\"classId\\\" = st.\\\"classId\\\"
  order by a.year desc, a.month desc limit 1
) live on true
join fee_charges c
  on c.\\\"studentId\\\" = st.id and c.kind = 'MONTHLY'
 and c.year = live.year and c.month = live.month
where st.status = 'ACTIVE' and st.\\\"feeWaived\\\" = false
  and st.\\\"monthlyFee\\\" > 0 and c.status <> 'INACTIVE'
  and c.amount <> st.\\\"monthlyFee\\\"
  and c.\\\"paidAmount\\\" = 0 $SCOPE
group by 1 order by 3 desc;
" "These students are billed something other than the fee on their record."

# A charge nobody can pay and nobody is owed. Distinct from the rule above
# because it also catches a student whose own fee is right but whose row is
# empty — the shape a desk reads as "nothing to collect".
report "no paying student carries an empty bill" "
select sc.name, count(*)
from students st
join schools sc on sc.id = st.\\\"schoolId\\\"
join fee_charges c on c.\\\"studentId\\\" = st.id and c.kind = 'MONTHLY'
join lateral (
  select a.year, a.month from monthly_fee_activations a
  where a.\\\"classId\\\" = st.\\\"classId\\\"
  order by a.year desc, a.month desc limit 1
) live on true
where st.status = 'ACTIVE' and st.\\\"feeWaived\\\" = false and st.\\\"monthlyFee\\\" > 0
  and c.year = live.year and c.month = live.month
  and c.amount = 0 and c.status <> 'INACTIVE' $SCOPE
group by 1 order by 2 desc;
" "A fee-paying student whose live month asks for nothing."

# Payroll must not point at somebody who is not there.
#
# Salary rows deliberately have no foreign key, so money paid to a person who
# has since left stays in the ledger — that part is right. What is wrong is a
# row still carrying their id: nothing can then tell a historical payment from
# a fault, and a re-hired person gets a second row beside the first. NUURUL
# -YAQIIN's administrator was in payroll three times for one month.
#
# Rows with the link cleared are invisible to this by design; they are the
# correct end state.
report "no payroll row points at a person who is gone" "
select sc.name, count(*), coalesce(sum(s.\\\"amountPaid\\\"), 0)
from salaries s join schools sc on sc.id = s.\\\"schoolId\\\"
where (
    (s.\\\"teacherId\\\" is not null
      and not exists (select 1 from teachers t where t.id = s.\\\"teacherId\\\"))
    or (s.\\\"employeeId\\\" is not null
      and not exists (select 1 from employees e where e.id = s.\\\"employeeId\\\"))
  ) $SCOPE
group by 1 order by 3 desc;
" "Payroll rows linked to a teacher or employee record that no longer exists."

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
