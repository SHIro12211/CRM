import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/;
const PHONE_REGEX = /^\+?\d{7,15}$/;
const EMAIL_REGEX = /.+@.+\..+/;

const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: corsHeaders });

function validateInput(data: any): string | null {
  if (!data?.id) return "User id is required";
  if (!data?.name?.trim()) return "Name is required";
  if (!NAME_REGEX.test(data.name.trim())) return "Name can only contain letters";
  if (data?.email && !EMAIL_REGEX.test(data.email.trim())) return "Valid email is required";
  if (data?.phone && !PHONE_REGEX.test(data.phone.trim())) return "Invalid phone";
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
      return fail("You don't have permission to edit users", 403);
    }

    // 3. Validar
    const body = await req.json();
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 4. Usuario a editar
    const { data: target } = await supabaseAdmin
      .from("users")
      .select("id, created_by")
      .eq("id", body.id)
      .single();
    if (!target) return fail("User not found", 404);

    // 5. Qué se puede cambiar según el rol
    const isSelf = target.id === user.id;
    const isOwnClient = target.created_by === user.id;
    const updateFields: Record<string, unknown> = {
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
    };
    if (body.email?.trim()) updateFields.email = body.email.trim();

    if (editorRole === "Advisor") {
      // Advisor: solo su propio perfil o usuarios que él creó, solo nombre y teléfono
      if (!isSelf && !isOwnClient) {
        return fail("You don't have permission to edit this user", 403);
      }
    } else {
      // Admin y Head Advisor: pueden cambiar rol y active
      if (typeof body.user_type_id === "number") {
        if (editorRole === "Head Advisor") {
          const { data: roleRow } = await supabaseAdmin
            .from("user_types")
            .select("name")
            .eq("id", body.user_type_id)
            .single();
          if (roleRow?.name === "Admin") {
            return fail("Head Advisor cannot assign the Admin role", 403);
          }
        }
        updateFields.user_type_id = body.user_type_id;
      }
      if (typeof body.active === "boolean") updateFields.active = body.active;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateFields)
      .eq("id", body.id)
      .select("id, name, email, phone, user_type_id, active")
      .single();
    if (updateError) return fail(updateError.message, 400);

    return Response.json(
      { message: "User updated successfully", data: updated },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
