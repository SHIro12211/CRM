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
  if (typeof data?.id !== "number") return "Course id is required";
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
      return fail("You don't have permission to edit courses", 403);
    }

    // 5. Temas que existen hoy
    const { data: existingTopics } = await supabaseAdmin
      .from("topics")
      .select("id, content, content_version")
      .eq("course_id", body.id);
    const existingMap = new Map(
      (existingTopics ?? []).map((t: any) => [t.id, t])
    );

    // 6. Borrar los temas que ya no vienen en el formulario
    const payloadIds = new Set(
      body.topics.filter((t: any) => t.id).map((t: any) => t.id)
    );
    const toDelete = (existingTopics ?? [])
      .filter((t: any) => !payloadIds.has(t.id))
      .map((t: any) => t.id);
    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin
        .from("topics")
        .delete()
        .in("id", toDelete);
      if (error) return fail(error.message, 400);
    }

    // 7. Actualizar el curso
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .update({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        price: body.price,
        duration: body.duration?.trim() || null,
        active: body.active,
      })
      .eq("id", body.id)
      .select()
      .single();
    if (courseError) return fail(courseError.message, 400);

    // 8. Sincronizar temas en el orden del formulario
    for (let index = 0; index < body.topics.length; index++) {
      const t = body.topics[index];
      const position = index + 1;
      if (t.id) {
        const existing = existingMap.get(t.id);
        const contentChanged =
          existing && existing.content !== (t.content ?? "");
        const { error } = await supabaseAdmin
          .from("topics")
          .update({
            name: t.name.trim(),
            content: t.content ?? "",
            position,
            content_version: contentChanged
              ? existing.content_version + 1
              : existing.content_version,
          })
          .eq("id", t.id);
        if (error) return fail(error.message, 400);
      } else {
        const { error } = await supabaseAdmin
          .from("topics")
          .insert({
            course_id: body.id,
            name: t.name.trim(),
            content: t.content ?? "",
            position,
          });
        if (error) return fail(error.message, 400);
      }
    }

    // 9. Devolver el curso con sus temas ordenados
    const { data: topics } = await supabaseAdmin
      .from("topics")
      .select("id, name, content, position, content_version")
      .eq("course_id", body.id)
      .order("position");

    return Response.json(
      { message: "Course updated successfully", data: { ...course, topics: topics ?? [] } },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return fail("Internal server error", 500);
  }
});
