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

function validateInput(data: any): string | null {
  if (!data?.id) return "Follow-up id is required";
  if (data?.follow_up_type_id !== undefined && typeof data.follow_up_type_id !== "number") return "Follow-up type is required";
  if (data?.next_contact !== undefined && (data.next_contact === null || Number.isNaN(Date.parse(data.next_contact)))) return "Valid next contact date is required";
  return null;
}

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

    // 2. Perfil del editor
    const { data: editor } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!editor) return fail("User not found", 404);
    const editorRole = editor.user_type_id?.name;
    if (editorRole === "Client") {
      return fail("You don't have permission to edit follow-ups", 403);
    }

    // 3. Validar
    const body = await req.json();
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 4. Seguimiento a editar
    const { data: followUp } = await supabaseAdmin
      .from("follow_ups")
      .select("id, advisor_id")
      .eq("id", body.id)
      .single();
    if (!followUp) return fail("Follow-up not found", 404);

    // 5. Permiso: Advisor solo sus propios seguimientos
    if (editorRole === "Advisor" && followUp.advisor_id !== user.id) {
      return fail("You can only edit your own follow-ups", 403);
    }

    // 6. Solo se pueden cambiar tipo, próximo contacto y notas (cliente, asesor y fecha no)
    if (body.follow_up_type_id !== undefined) {
      const { data: typeRow } = await supabaseAdmin
        .from("follow_up_types")
        .select("id")
        .eq("id", body.follow_up_type_id)
        .single();
      if (!typeRow) return fail("Follow-up type not found", 404);
    }
    const updateFields: Record<string, unknown> = {};
    if (body.follow_up_type_id !== undefined) updateFields.follow_up_type_id = body.follow_up_type_id;
    if (body.next_contact !== undefined) updateFields.next_contact = body.next_contact;
    if (body.notes !== undefined) updateFields.notes = body.notes?.trim() || null;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("follow_ups")
      .update(updateFields)
      .eq("id", body.id)
      .select("id, client_id, advisor_id, follow_up_type_id, date, next_contact, notes")
      .single();
    if (updateError) return fail(updateError.message, 400);

    return Response.json(
      { message: "Follow-up updated successfully", data: updated },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
