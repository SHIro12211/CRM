import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Usuario desde el token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("Unauthorized", 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return fail("Unauthorized", 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Perfil del que borra
    const { data: editor } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!editor) return fail("User not found", 404);
    const editorRole = editor.user_type_id?.name;
    if (editorRole === "Client") {
      return fail("You don't have permission to delete follow-ups", 403);
    }

    const body = await req.json();
    const followUpId = body.followUpId || body.id;
    if (!followUpId) return fail("Follow-up id is required", 400);

    // 3. Seguimiento
    const { data: followUp } = await supabaseAdmin
      .from("follow_ups")
      .select("id, advisor_id")
      .eq("id", followUpId)
      .single();
    if (!followUp) return fail("Follow-up not found", 404);

    // 4. Permiso: Advisor solo sus propios seguimientos
    if (editorRole === "Advisor" && followUp.advisor_id !== user.id) {
      return fail("You can only delete your own follow-ups", 403);
    }

    // 5. Borrar
    const { error: deleteError } = await supabaseAdmin
      .from("follow_ups")
      .delete()
      .eq("id", followUpId);
    if (deleteError) return fail(deleteError.message, 400);

    return Response.json(
      { message: "Follow-up deleted successfully" },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
