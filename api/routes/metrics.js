const { query } = require('../_lib/db');
const { startOfMonth, endOfMonth, startOfWeek, endOfWeek } = require('../_lib/utils');
function fmt(d){ return d.toISOString().slice(0,10); }
async function getSettings(){ return (await query(`select * from settings order by id asc limit 1;`)).rows[0]; }
module.exports = async (req,res)=>{
  const s = await getSettings();
  const today = new Date();
  const isWeek = (req.query.period === 'week') || (s.period_mode === 'week');
  const start = isWeek ? startOfWeek(today, s.week_starts_on || 1) : startOfMonth(today);
  const end = isWeek ? endOfWeek(today, s.week_starts_on || 1) : endOfMonth(today);
  const spent = (await query(`select coalesce(sum(amount),0) as v from transactions where type='expense' and date between $1 and $2`, [fmt(start), fmt(end)])).rows[0];
  const inc = (await query(`select coalesce(sum(amount),0) as v from transactions where type='income' and date <= $1`, [fmt(today)])).rows[0];
  const exp = (await query(`select coalesce(sum(amount),0) as v from transactions where type='expense' and date <= $1`, [fmt(today)])).rows[0];
  const current_balance = Number(s.initial_balance||0) + Number(inc.v) - Number(exp.v);
  const plan = (await query(`select coalesce(sum(amount),0) as v from planned where next_due_date between $1 and $2`, [fmt(today), fmt(end)])).rows[0];
  const planned_to_go = Number(plan.v);
  const will_remain = current_balance - planned_to_go;
  const last5 = (await query(`select id,type,title,date,amount,group_id from transactions order by date desc, created_at desc limit 5`)).rows;
  const periodKey = isWeek ? `${today.getFullYear()}-W${Math.ceil((today - startOfWeek(new Date(today.getFullYear(),0,1),1)) / (7*24*3600*1000))}`
                           : `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const budgets = (await query(`
    with spent as (
      select group_id, coalesce(sum(amount),0) as v
      from transactions
      where type='expense' and date between $1 and $2 and group_id is not null
      group by group_id
    )
    select b.id, b.group_id, b.period, b.limit_amount,
           g.name as group_name,
           coalesce(s.v,0) as spent_amount,
           greatest(b.limit_amount - coalesce(s.v,0), 0) as remain_amount
    from budgets b
    left join groups g on g.id=b.group_id
    left join spent s on s.group_id=b.group_id
    where b.period = $3
    order by (case when b.limit_amount>0 then coalesce(s.v,0)/b.limit_amount else 0 end) desc
    limit 3
  `, [fmt(start), fmt(end), periodKey])).rows;
  res.end(JSON.stringify({ ok:true, data:{
    period: isWeek ? 'week' : 'month',
    dates:{ start:fmt(start), end:fmt(end), today:fmt(today) },
    kpi:{ current_balance, spent_period:Number(spent.v), planned_to_go, will_remain },
    last5, budgetsTop: budgets
  }}));
};