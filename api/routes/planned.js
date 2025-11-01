const { query } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET'){
    const { from, to } = req.query || {};
    const clauses=[]; const params=[];
    if (from){ params.push(from); clauses.push(`(next_due_date is null or next_due_date >= $${params.length})`); }
    if (to){ params.push(to); clauses.push(`(next_due_date is null or next_due_date <= $${params.length})`); }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const sql = `select p.*, g.name as group_name, g.color as group_color
                 from planned p left join groups g on g.id=p.group_id
                 ${where}
                 order by coalesce(next_due_date, now()) asc, id desc`;
    const { rows } = await query(sql, params);
    return res.end(JSON.stringify({ ok:true, data: rows }));
  }

  if (req.method === 'POST'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const {
          plan_type, title, amount, groupId,
          first_date=null, rule_freq=null, rule_n=null,
          next_due_date=null, auto_post=false, remind=false, note=null
        } = JSON.parse(body||'{}');
        if (!['subscription','recurring','oneoff'].includes(plan_type)) throw new Error('plan_type invalid');
        if (!title) throw new Error('title required');
        if (!(amount>0)) throw new Error('amount>0 required');

        const { rows } = await query(`
          insert into planned(plan_type,title,amount,group_id,first_date,rule_freq,rule_n,next_due_date,auto_post,remind,note)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
          [plan_type, title, amount, groupId, first_date, rule_freq, rule_n, next_due_date, auto_post, remind, note]
        );
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    });
    return;
  }

  if (req.method === 'PUT'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const { id, title, amount, groupId, next_due_date, auto_post, remind, note, plan_type, rule_freq, rule_n } = JSON.parse(body||'{}');
        if (!id) throw new Error('id required');
        const { rows } = await query(`
          update planned set
            plan_type = coalesce($2, plan_type),
            title = coalesce($3, title),
            amount = coalesce($4, amount),
            group_id = coalesce($5, group_id),
            next_due_date = coalesce($6, next_due_date),
            auto_post = coalesce($7, auto_post),
            remind = coalesce($8, remind),
            note = $9,
            rule_freq = coalesce($10, rule_freq),
            rule_n = coalesce($11, rule_n)
          where id=$1 returning *`,
          [id, plan_type, title, amount, groupId, next_due_date, auto_post, remind, note, rule_freq, rule_n]
        );
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    });
    return;
  }

  if (req.method === 'DELETE'){
    const id = parseInt(req.query?.id||'0',10);
    if (!id){ res.statusCode=400; return res.end(JSON.stringify({ ok:false, error:'id required'})); }
    await query(`delete from planned where id=$1`, [id]);
    return res.end(JSON.stringify({ ok:true }));
  }

  res.statusCode=405; res.end(JSON.stringify({ ok:false, error:'method_not_allowed'}));
};
