const { query } = require('../_lib/db');
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const includeArchived = (req.query.includeArchived === 'true');
    const { rows } = await query(`select * from groups where ($1 or archived=false) order by created_at desc`, [includeArchived]);
    return res.end(JSON.stringify({ ok:true, data: rows }));
  }
  if (req.method === 'POST') {
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try {
        const { name, comment=null, color=null } = JSON.parse(body||'{}');
        if (!name) throw new Error('name required');
        const { rows } = await query(`insert into groups(name, comment, color) values ($1,$2,$3) returning *`, [name, comment, color]);
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      } catch(e) {
        res.statusCode = 400; res.end(JSON.stringify({ ok:false, error:e.message }));
      }
    }); return;
  }
  if (req.method === 'PUT') {
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try {
        const { id, name, comment, color, archived } = JSON.parse(body||'{}');
        if (!id) throw new Error('id required');
        const { rows } = await query(`update groups set name=coalesce($2,name), comment=$3, color=$4, archived=coalesce($5, archived) where id=$1 returning *`,
          [id, name, comment, color, archived]);
        res.end(JSON.stringify({ ok:true, data: rows[0] }));
      } catch(e) {
        res.statusCode = 400; res.end(JSON.stringify({ ok:false, error:e.message }));
      }
    }); return;
  }
  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id||'0',10);
    if (!id) { res.statusCode=400; return res.end(JSON.stringify({ ok:false, error:'id required'})); }
    await query(`delete from groups where id=$1`, [id]);
    return res.end(JSON.stringify({ ok:true }));
  }
  res.statusCode=405; res.end(JSON.stringify({ ok:false, error:'method_not_allowed'}));
};
