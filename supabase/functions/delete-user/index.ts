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
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Usuario desde el token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("Unauthorized", 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return fail("Unauthorized", 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Solo Admin puede borrar usuarios
    const { data: editor } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!editor) return fail("User not found", 404);
    if (editor.user_type_id?.name !== "Admin") {
      return fail("Only Admin can delete users", 403);
    }

    const body = await req.json();
    const userId = body.userId || body.id;
    if (!userId) return fail("User id is required", 400);
    if (userId === user.id)
      return fail("You cannot delete your own account", 400);

    // 3. Si es asesor con seguimientos, no se puede borrar (no hay cascada en follow_ups)
    const { count } = await supabaseAdmin
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("advisor_id", userId);
    if ((count ?? 0) > 0) {
      return fail(
        "Cannot delete a user with follow-ups. Deactivate the user instead.",
        400,
      );
    }

    // 4. Borrar la fila de public.users (la cascada limpia clientes, inscripciones, etc.)
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);
    if (profileError) return fail(profileError.message, 400);

    // 5. Borrar la cuenta de Auth
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) console.error("deleteUser auth error:", authError.message);

    return Response.json(
      { message: "User deleted successfully" },
      { headers: corsHeaders },
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
