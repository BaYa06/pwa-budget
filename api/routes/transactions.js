const { query } = require('../_lib/db');
module.exports = async (req, res) => {
  if (req.method === 'GET'){
    const { from, to, type, groupId } = req.query;
    const clauses=[]; const params=[];
    if (from){ params.push(from); clauses.push(`date >= $${params.length}`); }
    if (to){ params.push(to); clauses.push(`date <= $${params.length}`); }
    if (type){ params.push(type); clauses.push(`type = $${params.length}`); }
    if (groupId){ params.push(parseInt(groupId)); clauses.push(`group_id = $${params.length}`); }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const sql = `select t.*, g.name as group_name, g.color as group_color from transactions t left join groups g on g.id=t.group_id ${where} order by date desc, created_at desc limit 500`;
    const { rows } = await query(sql, params);
    return res.end(JSON.stringify({ ok:true, data: rows }));
  }
  if (req.method === 'POST'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const { type, title, date, amount, groupId=null, comment=null } = JSON.parse(body||'{}');
        if (!type || !['expense','income'].includes(type)) throw new Error('type invalid');
        if (!title) throw new Error('title required');
        if (!date) throw new Error('date required');
        if (!(amount>0)) throw new Error('amount>0 required');
        const { rows } = await query(`insert into transactions(type,title,date,amount,group_id,comment) values ($1,$2,$3,$4,$5,$6) returning *`,
          [type, title, date, amount, groupId, comment]);
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    }); return;
  }
  if (req.method === 'PUT'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const { id, type, title, date, amount, groupId, comment } = JSON.parse(body||'{}');
        if (!id) throw new Error('id required');
        const { rows } = await query(`update transactions set
          type = coalesce($2, type),
          title = coalesce($3, title),
          date  = coalesce($4, date),
          amount= coalesce($5, amount),
          group_id = $6,
          comment = $7,
          updated_at = now()
          where id=$1 returning *`,
          [id, type, title, date, amount, groupId, comment]);
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    }); return;
  }
  if (req.method === 'DELETE'){
    const id = parseInt(req.query.id||'0',10);
    if (!id){ res.statusCode=400; return res.end(JSON.stringify({ ok:false, error:'id required'})); }
    await query(`delete from transactions where id=$1`, [id]);
    return res.end(JSON.stringify({ ok:true }));
  }
  res.statusCode=405; res.end(JSON.stringify({ ok:false, error:'method_not_allowed'}));
};