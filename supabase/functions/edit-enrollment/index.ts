import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYMENT_TYPES = ["Full", "Parcial"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: corsHeaders });

function validateInput(data: any): string | null {
  if (!data?.id) return "Enrollment id is required";
  if (data?.agreed_price !== undefined && (typeof data.agreed_price !== "number" || data.agreed_price <= 0)) return "Agreed price must be greater than 0";
  if (data?.payment_type !== undefined && !PAYMENT_TYPES.includes(data.payment_type)) return "Payment type must be Full or Parcial";
  if (data?.enrollment_date !== undefined && !DATE_REGEX.test(data.enrollment_date)) return "Valid enrollment date is required";
  if (data?.status_id !== undefined && data?.status_id !== null && typeof data.status_id !== "number") return "Invalid status";
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
      return fail("You don't have permission to edit enrollments", 403);
    }

    // 3. Validar
    const body = await req.json();
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 4. Inscripción a editar
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("id, client_id")
      .eq("id", body.id)
      .single();
    if (!enrollment) return fail("Enrollment not found", 404);

    // 5. Permiso: Advisor solo las inscripciones de sus clientes
    if (editorRole === "Advisor") {
      const { data: clientUser } = await supabaseAdmin
        .from("users")
        .select("created_by")
        .eq("id", enrollment.client_id)
        .single();
      if (clientUser?.created_by !== user.id) {
        return fail("You can only edit enrollments of your own clients", 403);
      }
    }

    // 6. Solo se pueden cambiar precio, tipo de pago, fecha y estado (cliente y curso no, porque ya existe progreso)
    if (body.status_id !== undefined && body.status_id !== null) {
      const { data: statusRow } = await supabaseAdmin
        .from("enrollment_statuses")
        .select("id")
        .eq("id", body.status_id)
        .single();
      if (!statusRow) return fail("Status not found", 404);
    }
    const updateFields: Record<string, unknown> = {};
    if (body.agreed_price !== undefined) updateFields.agreed_price = body.agreed_price;
    if (body.payment_type !== undefined) updateFields.payment_type = body.payment_type;
    if (body.enrollment_date !== undefined) updateFields.enrollment_date = body.enrollment_date;
    if (body.status_id !== undefined) updateFields.status_id = body.status_id;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("enrollments")
      .update(updateFields)
      .eq("id", body.id)
      .select("id, client_id, course_id, agreed_price, payment_type, enrollment_date, status_id")
      .single();
    if (updateError) return fail(updateError.message, 400);

    return Response.json(
      { message: "Enrollment updated successfully", data: updated },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
