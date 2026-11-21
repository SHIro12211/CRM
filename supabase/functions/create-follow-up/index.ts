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
  if (!data?.client_id) return "Client is required";
  if (typeof data?.follow_up_type_id !== "number") return "Follow-up type is required";
  if (!data?.next_contact || Number.isNaN(Date.parse(data.next_contact))) return "Valid next contact date is required";
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

    // 2. Perfil del creador
    const { data: creator } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!creator) return fail("User not found", 404);
    const creatorRole = creator.user_type_id?.name;
    if (creatorRole === "Client") {
      return fail("You don't have permission to create follow-ups", 403);
    }

    // 3. Validar
    const body = await req.json();
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 4. El cliente debe existir y, si el creador es Advisor, ser suyo
    const { data: clientUser } = await supabaseAdmin
      .from("users")
      .select("id, created_by")
      .eq("id", body.client_id)
      .single();
    if (!clientUser) return fail("Client not found", 404);
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("user_id", body.client_id)
      .single();
    if (!clientRow) return fail("Client not found", 404);
    if (creatorRole === "Advisor" && clientUser.created_by !== user.id) {
      return fail("You can only create follow-ups for your own clients", 403);
    }

    // 5. El tipo debe existir
    const { data: typeRow } = await supabaseAdmin
      .from("follow_up_types")
      .select("id")
      .eq("id", body.follow_up_type_id)
      .single();
    if (!typeRow) return fail("Follow-up type not found", 404);

    // 6. Insertar (date toma now() por defecto; el asesor es el usuario logueado)
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("follow_ups")
      .insert({
        client_id: body.client_id,
        advisor_id: user.id,
        follow_up_type_id: body.follow_up_type_id,
        next_contact: body.next_contact,
        notes: body.notes?.trim() || null,
      })
      .select("id, client_id, advisor_id, follow_up_type_id, date, next_contact, notes")
      .single();
    if (insertError) return fail(insertError.message, 400);

    return Response.json(
      { message: "Follow-up created successfully", data: inserted },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
