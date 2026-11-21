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
  if (!data?.name?.trim()) return "Name is required";
  if (typeof data.price !== "number" || data.price < 0) return "Price must be 0 or more";
  if (!Array.isArray(data.topics) || data.topics.length === 0) return "Add at least one topic";
  if (data.topics.some((t: any) => !t?.name?.trim())) return "Every topic needs a name";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Usuario desde el token que manda functions.invoke
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return fail("Unauthorized", 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Perfil y rol
    const { data: creator } = await supabaseAdmin
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", user.id)
      .single();
    if (!creator) return fail("User not found", 404);
    const creatorRole = creator.user_type_id?.name;

    // 3. Validar
    const body = await req.json();
    const validationError = validateInput(body);
    if (validationError) return fail(validationError);

    // 4. Permiso: solo Admin y Head Advisor
    if (creatorRole !== "Admin" && creatorRole !== "Head Advisor") {
      return fail("You don't have permission to create courses", 403);
    }

    // 5. Crear el curso
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        price: body.price,
        duration: body.duration?.trim() || null,
        active: body.active ?? true,
      })
      .select()
      .single();
    if (courseError) return fail(courseError.message, 400);

    // 6. Crear los temas
    const { error: topicsError } = await supabaseAdmin
      .from("topics")
      .insert(
        body.topics.map((t: any, index: number) => ({
          course_id: course.id,
          name: t.name.trim(),
          content: t.content ?? "",
          position: index + 1,
        }))
      );
    if (topicsError) {
      await supabaseAdmin.from("courses").delete().eq("id", course.id);
      return fail(topicsError.message, 400);
    }

    return Response.json(
      { message: "Course created successfully", data: { id: course.id } },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
