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
  if (!data?.client_id) return "Client is required";
  if (!data?.course_id) return "Course is required";
  if (typeof data?.agreed_price !== "number" || data.agreed_price <= 0) return "Agreed price must be greater than 0";
  if (!PAYMENT_TYPES.includes(data?.payment_type)) return "Payment type must be Full or Parcial";
  if (!data?.enrollment_date || !DATE_REGEX.test(data.enrollment_date)) return "Valid enrollment date is required";
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

    // 2. Perfil del creador
    const { data: creator } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!creator) return fail("User not found", 404);
    const creatorRole = creator.user_type_id?.name;
    if (creatorRole === "Client") {
      return fail("You don't have permission to create enrollments", 403);
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
      return fail("You can only enroll your own clients", 403);
    }

    // 5. El curso debe existir y estar activo
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, active")
      .eq("id", body.course_id)
      .single();
    if (!course) return fail("Course not found", 404);
    if (!course.active) return fail("Course is not active", 400);

    // 6. Estado (por defecto Active)
    let statusId = body.status_id ?? null;
    if (statusId === null) {
      const { data: activeStatus } = await supabaseAdmin
        .from("enrollment_statuses")
        .select("id")
        .eq("name", "Active")
        .single();
      statusId = activeStatus?.id ?? null;
    }
    if (statusId !== null) {
      const { data: statusRow } = await supabaseAdmin
        .from("enrollment_statuses")
        .select("id")
        .eq("id", statusId)
        .single();
      if (!statusRow) return fail("Status not found", 404);
    }

    // 7. Insertar (el trigger create_topic_progress crea el progreso de los temas)
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("enrollments")
      .insert({
        client_id: body.client_id,
        course_id: body.course_id,
        agreed_price: body.agreed_price,
        payment_type: body.payment_type,
        enrollment_date: body.enrollment_date,
        status_id: statusId,
      })
      .select("id, client_id, course_id, agreed_price, payment_type, enrollment_date, status_id")
      .single();
    if (insertError) return fail(insertError.message, 400);

    return Response.json(
      { message: "Enrollment created successfully", data: inserted },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
