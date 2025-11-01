const { query } = require('../_lib/db');
module.exports = async (req, res) => {
  if (req.method === 'GET'){
    const { period } = req.query;
    const { rows } = await query(`
      select b.*, g.name as group_name, g.color as group_color
      from budgets b
      left join groups g on g.id=b.group_id
      where ($1::text is null or b.period=$1)
      order by b.created_at desc
    `, [period || null]);
    return res.end(JSON.stringify({ ok:true, data: rows }));
  }
  if (req.method === 'POST' || req.method === 'PUT'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const { groupId, period, limit } = JSON.parse(body||'{}');
        if (!groupId || !period || !(limit>0)) throw new Error('groupId, period, limit required');
        const { rows } = await query(`
          insert into budgets(group_id, period, limit_amount) values ($1,$2,$3)
          on conflict do nothing
          returning *`,
          [groupId, period, limit]);
        if (rows.length) return res.end(JSON.stringify({ ok:true, data: rows[0] }));
        const { rows: r2 } = await query(`update budgets set limit_amount=$3 where group_id=$1 and period=$2 returning *`,
          [groupId, period, limit]);
        res.end(JSON.stringify({ ok:true, data: r2[0] }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    }); return;
  }
  if (req.method === 'DELETE'){
    const id = parseInt(req.query.id||'0',10);
    if (!id){ res.statusCode=400; return res.end(JSON.stringify({ ok:false, error:'id required'})); }
    await query(`delete from budgets where id=$1`, [id]);
    return res.end(JSON.stringify({ ok:true }));
  }
  res.statusCode=405; res.end(JSON.stringify({ ok:false, error:'method_not_allowed'}));
};