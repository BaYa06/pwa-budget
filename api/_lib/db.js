const { Pool } = require('pg');
let pool;

function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL;
    if (!conn) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString: conn });
  }
  return pool;
}

async function ensureSchema() {
  const client = await getPool().connect();
  try {
    await client.query(`
      create table if not exists settings (
        id serial primary key,
        initial_balance numeric default 0,
        currency text default 'KGS',
        period_mode text default 'month',
        week_starts_on int default 1,
        pin_enabled boolean default false
      );
      create table if not exists groups (
        id serial primary key,
        name text not null,
        comment text,
        color text,
        archived boolean default false,
        created_at timestamptz default now()
      );
      create table if not exists budgets (
        id serial primary key,
        group_id int references groups(id) on delete cascade,
        period text not null,
        limit_amount numeric not null,
        carry_over boolean default false,
        created_at timestamptz default now()
      );
      create table if not exists transactions (
        id serial primary key,
        type text check (type in ('expense','income')) not null,
        title text not null,
        date date not null,
        amount numeric not null check (amount > 0),
        group_id int references groups(id),
        comment text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      create table if not exists planned (
        id serial primary key,
        plan_type text check (plan_type in ('subscription','recurring','oneoff')) not null,
        title text not null,
        amount numeric not null,
        group_id int references groups(id),
        first_date date,
        rule_freq text,
        rule_n int,
        next_due_date date,
        auto_post boolean default false,
        remind boolean default false,
        note text
      );
      create table if not exists templates (
        id serial primary key,
        kind text check (kind in ('expense','income')) not null,
        title text,
        amount numeric,
        group_id int references groups(id),
        pinned boolean default false,
        last_used_at timestamptz
      );
    `);
    const { rows } = await client.query(`select count(*)::int as c from settings;`);
    if (rows[0].c === 0) await client.query(`insert into settings(initial_balance) values (0);`);
  } finally {
    client.release();
  }
}

async function query(sql, params = []) {
  return getPool().query(sql, params);
}

module.exports = { getPool, ensureSchema, query };
