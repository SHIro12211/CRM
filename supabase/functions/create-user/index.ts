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

const PERMISSIONS: Record<string, string[]> = {
  Admin: ["Admin", "Head Advisor", "Advisor", "Client"],
  "Head Advisor": ["Advisor", "Client"],
  Advisor: ["Client"],
  Client: [],
};

const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: corsHeaders });

function validateInput(data: any): string | null {
  if (!data?.name?.trim()) return "Name is required";
  if (!NAME_REGEX.test(data.name.trim())) return "Name can only contain letters";
  if (!data?.email?.trim() || !EMAIL_REGEX.test(data.email.trim())) return "Valid email is required";
  if (!data?.password) return "Password is required";
  if (data.password.length < 8) return "Password must be at least 8 characters";
  if (data.password !== data.confirm_password) return "Passwords do not match";
  if (data?.phone && !PHONE_REGEX.test(data.phone.trim())) return "Invalid phone";
  if (data?.user_type_id === undefined || data?.user_type_id === null || data?.user_type_id === "") return "User type is required";
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

    const body = await req.json();

    // 3. Si el creador es Advisor, el nuevo usuario siempre es Client
    if (creatorRole === "Advisor") {
      const { data: clientRole } = await supabaseAdmin
        .from("user_types")
        .select("id")
        .eq("name", "Client")
        .single();
      if (clientRole) body.user_type_id = clientRole.id;
    }

    // 4. Validar
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 5. Resolver el rol (acepta id o nombre)
    let roleRow: { id: number; name: string } | null = null;
    if (typeof body.user_type_id === "number") {
      const { data } = await supabaseAdmin.from("user_types").select("id, name").eq("id", body.user_type_id).single();
      roleRow = data;
    } else {
      const { data } = await supabaseAdmin.from("user_types").select("id, name").eq("name", body.user_type_id).single();
      roleRow = data;
    }
    if (!roleRow) return fail("User type not found", 404);

    // 6. Permiso
    if (!PERMISSIONS[creatorRole]?.includes(roleRow.name)) {
      return fail("You don't have permission to create this user type", 403);
    }

    // 7. Crear en Auth (el trigger handle_new_user crea la fila en public.users)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: {
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        created_by: user.id,
        user_type_id: roleRow.id,
      },
    });
    if (createError) return fail(createError.message, 400);

    return Response.json(
      { message: "User created successfully", user: { id: newUser.user.id, email: body.email.trim() } },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
