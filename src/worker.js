export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Dynamic CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Pre-flight OPTIONS request handling
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Intercept all /api/* requests
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) {
        return new Response(
          JSON.stringify({ error: "Cloudflare D1 Binding 'DB' is missing in wrangler.jsonc." }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // --- USERS API ENDPOINTS ---
        if (url.pathname === '/api/users') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY elo DESC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            
            // Insert user into D1 SQL Table
            await env.DB.prepare(`
              INSERT INTO users (id, playerId, name, whatsapp, password, role, grade, elo, avatar, membershipStatus, duesOwed, matchesPlayed, wins)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              body.id,
              body.playerId,
              body.name,
              body.whatsapp,
              body.password || '',
              body.role || 'PLAYER',
              body.grade || 'D (Beginner)',
              body.elo || 1200,
              body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              body.membershipStatus || 'Active',
              body.duesOwed || 0,
              body.matchesPlayed || 0,
              body.wins || 0
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'User written to D1', playerId: body.playerId }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // --- COURTS API ENDPOINTS ---
        if (url.pathname === '/api/courts') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM courts").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // --- BOOKINGS API ENDPOINTS ---
        if (url.pathname === '/api/bookings') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM bookings ORDER BY id DESC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            await env.DB.prepare(`
              INSERT INTO bookings (id, courtId, courtName, courtCode, playerName, playerId, date, timeSlot, type, paymentStatus, fee)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              body.id, body.courtId, body.courtName, body.courtCode || '', body.playerName, body.playerId,
              body.date, body.timeSlot, body.type, body.paymentStatus, body.fee
            ).run();

            return new Response(
              JSON.stringify({ success: true, message: 'Booking written to D1' }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // --- MATCHES API ENDPOINTS ---
        if (url.pathname === '/api/matches') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM matches ORDER BY id DESC").all();
            const parsed = (results || []).map(m => ({
              ...m,
              team1: JSON.parse(m.team1 || '[]'),
              team2: JSON.parse(m.team2 || '[]'),
              score1: JSON.parse(m.score1 || '[0]'),
              score2: JSON.parse(m.score2 || '[0]'),
            }));
            return new Response(JSON.stringify(parsed), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // --- INVOICES API ENDPOINTS ---
        if (url.pathname === '/api/invoices') {
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM invoices ORDER BY dueDate DESC").all();
            return new Response(JSON.stringify(results || []), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        return new Response(
          JSON.stringify({ error: `API route '${url.pathname}' not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (dbErr) {
        return new Response(
          JSON.stringify({ error: dbErr.message || 'Database Query Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default static assets fallback for Vite bundle HTML/JS/CSS
    return env.ASSETS.fetch(request);
  }
};