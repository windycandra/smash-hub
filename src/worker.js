export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Dynamic CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) {
        return new Response(
          JSON.stringify({ error: "Cloudflare D1 Binding 'DB' is missing in wrangler.jsonc." }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // --- USERS TABLE ENDPOINTS ---
        if (url.pathname === '/api/users') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY elo DESC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            const pId = body.player_id || body.playerId;
            const fullName = body.full_name || body.name;
            const whatsapp = body.whatsapp_number || body.whatsapp;
            const pwd = body.password_hash || body.password || '';
            const memStatus = body.membership_status || body.membershipStatus || 'Active';
            const dues = body.dues_owed ?? body.duesOwed ?? 0.0;
            const matchesPlayed = body.matches_played ?? body.matchesPlayed ?? 0;

            await env.DB.prepare(`
              INSERT INTO users (
                id, player_id, full_name, whatsapp_number, password_hash, 
                role, grade, elo, avatar, membership_status, dues_owed, 
                matches_played, wins
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              body.id,
              pId,
              fullName,
              whatsapp,
              pwd,
              body.role || 'PLAYER',
              body.grade || 'D (Beginner)',
              body.elo ?? 1200,
              body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              memStatus,
              dues,
              matchesPlayed,
              body.wins ?? 0
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'User stored in D1 users table', player_id: pId }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (request.method === 'PUT') {
            const body = await request.json();
            const pId = body.player_id || body.playerId;
            const fullName = body.full_name || body.name;
            const whatsapp = body.whatsapp_number || body.whatsapp;
            const memStatus = body.membership_status || body.membershipStatus || 'Active';

            await env.DB.prepare(`
              UPDATE users SET 
                player_id = ?, full_name = ?, whatsapp_number = ?, role = ?, 
                grade = ?, elo = ?, membership_status = ?, dues_owed = ?
              WHERE id = ?
            `).bind(
              pId,
              fullName,
              whatsapp,
              body.role,
              body.grade,
              body.elo,
              memStatus,
              body.dues_owed ?? body.duesOwed ?? 0.0,
              body.id
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'User updated in D1' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // --- COURTS TABLE ENDPOINTS ---
        if (url.pathname === '/api/courts') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM courts ORDER BY id ASC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            await env.DB.prepare(`
              INSERT INTO courts (name, court_code, status, current_match_id)
              VALUES (?, ?, ?, ?)
            `).bind(
              body.name,
              body.court_code || body.courtCode,
              body.status || 'Available',
              body.current_match_id || body.currentMatchId || null
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'Court stored in D1 courts table' }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // --- BOOKINGS TABLE ENDPOINTS ---
        if (url.pathname === '/api/bookings') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            await env.DB.prepare(`
              INSERT INTO bookings (
                id, court_id, court_name, court_code, player_name, 
                player_id, booking_date, time_slot, type, payment_status, fee
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              body.id,
              body.court_id || body.courtId,
              body.court_name || body.courtName,
              body.court_code || body.courtCode,
              body.player_name || body.playerName,
              body.player_id || body.playerId,
              body.booking_date || body.date,
              body.time_slot || body.timeSlot,
              body.type,
              body.payment_status || body.paymentStatus,
              body.fee
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'Booking stored in D1 bookings table' }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: `Route '${url.pathname}' not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (dbErr) {
        return new Response(
          JSON.stringify({ error: dbErr.message || 'Database SQL Execution Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
