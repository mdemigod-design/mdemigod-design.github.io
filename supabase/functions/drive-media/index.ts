import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.mongkol-wu.in.th",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const origin = req.headers.get("origin") || "";
  if (origin && !["https://www.mongkol-wu.in.th", "https://mongkol-wu.in.th", "http://localhost:5173"].includes(origin)) {
    return reply({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const publishableKey = keys ? (JSON.parse(keys).default || Object.values(JSON.parse(keys))[0]) : Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !publishableKey) return reply({ ok: false, error: "Supabase environment is not configured" }, 500);

    const supabase = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return reply({ ok: false, error: "เซสชันไม่ถูกต้องหรือหมดอายุ" }, 401);

    const { data: admin, error: adminError } = await supabase
      .from("admin_users").select("is_active").eq("user_id", authData.user.id).maybeSingle();
    if (adminError || !admin?.is_active) return reply({ ok: false, error: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ" }, 403);

    const gasUrl = Deno.env.get("GAS_WEB_APP_URL");
    if (!gasUrl) return reply({ ok: false, error: "ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL ใน Supabase Secrets" }, 503);

    const payload = await req.json();
    const allowed = ["upload", "set-public", "trash"];
    if (!allowed.includes(payload.action)) return reply({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, 400);
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, accessToken: token }),
      redirect: "follow",
    });
    const text = await response.text();
    let result: Record<string, unknown>;
    try { result = JSON.parse(text); } catch { return reply({ ok: false, error: "GAS returned an unreadable response" }, 502); }
    if (!response.ok || result.ok !== true) return reply(result, response.ok ? 400 : 502);
    return reply(result, 200);
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
