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
      return fail("You don't have permission to delete enrollments", 403);
    }

    const body = await req.json();
    const enrollmentId = body.enrollmentId || body.id;
    if (!enrollmentId) return fail("Enrollment id is required", 400);

    // 3. Inscripción
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("id, client_id")
      .eq("id", enrollmentId)
      .single();
    if (!enrollment) return fail("Enrollment not found", 404);

    // 4. Permiso: Advisor solo las inscripciones de sus clientes
    if (editorRole === "Advisor") {
      const { data: clientUser } = await supabaseAdmin
        .from("users")
        .select("created_by")
        .eq("id", enrollment.client_id)
        .single();
      if (clientUser?.created_by !== user.id) {
        return fail("You can only delete enrollments of your own clients", 403);
      }
    }

    // 5. No se puede borrar si tiene pagos
    const { count } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId);
    if ((count ?? 0) > 0) {
      return fail("Cannot delete an enrollment with payments", 400);
    }

    // 6. Borrar el progreso y la inscripción
    await supabaseAdmin.from("topic_progress").delete().eq("enrollment_id", enrollmentId);
    const { error: deleteError } = await supabaseAdmin
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);
    if (deleteError) return fail(deleteError.message, 400);

    return Response.json(
      { message: "Enrollment deleted successfully" },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
