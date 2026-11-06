// functions/api/[[route]].js - Cloudflare Pages Function D1 Router
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, ''); // strip trailing slash

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ 
      error: 'D1 binding missing! Please bind your D1 database as DB under Cloudflare Pages Settings -> Functions.' 
    }), { status: 500, headers });
  }

  try {
    // GET /api/users
    if (pathname === '/api/users' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY elo DESC").all();
      const mapped = results.map(u => ({
        id: u.id,
        playerId: u.player_id,
        name: u.full_name,
        whatsapp: u.whatsapp_number,
        role: u.role,
        grade: u.grade,
        elo: u.elo,
        avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        membershipStatus: u.membership_status,
        duesOwed: u.dues_owed,
        matchesPlayed: u.matches_played,
        wins: u.wins
      }));
      return new Response(JSON.stringify(mapped), { headers });
    }

    // POST /api/users (User Registration)
    if (pathname === '/api/users' && request.method === 'POST') {
      const data = await request.json();
      await env.DB.prepare(
        `INSERT INTO users (id, player_id, full_name, whatsapp_number, password_hash, role, grade, elo, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.id, 
        data.playerId, 
        data.name, 
        data.whatsapp, 
        data.password || 'default123', 
        data.role, 
        data.grade || 'D (Beginner)', 
        data.elo || 1200, 
        data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
      ).run();

      return new Response(JSON.stringify({ success: true, playerId: data.playerId }), { headers });
    }

    // GET /api/courts
    if (pathname === '/api/courts' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM courts ORDER BY id ASC").all();
      const mapped = results.map(c => ({
        id: c.id,
        courtCode: c.court_code,
        name: c.name,
        status: c.status,
        currentMatchId: c.current_match_id
      }));
      return new Response(JSON.stringify(mapped), { headers });
    }

    // GET /api/bookings
    if (pathname === '/api/bookings' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
      const mapped = results.map(b => ({
        id: b.id,
        courtId: b.court_id,
        courtName: b.court_name,
        courtCode: b.court_code,
        playerName: b.player_name,
        playerId: b.player_id,
        date: b.booking_date,
        timeSlot: b.time_slot,
        type: b.type,
        paymentStatus: b.payment_status,
        fee: b.fee
      }));
      return new Response(JSON.stringify(mapped), { headers });
    }

    // POST /api/bookings
    if (pathname === '/api/bookings' && request.method === 'POST') {
      const b = await request.json();
      await env.DB.prepare(
        `INSERT INTO bookings (id, court_id, court_name, court_code, player_name, player_id, booking_date, time_slot, type, payment_status, fee) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(b.id, b.courtId, b.courtName, b.courtCode, b.playerName, b.playerId, b.date, b.timeSlot, b.type, b.paymentStatus, b.fee).run();

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: `Route not found: ${pathname}` }), { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
