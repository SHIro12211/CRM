import { withSupabase } from "@supabase/server";

export const getAuthenticatedUser = (handler) => {

  return withSupabase({ auth: "user" }, async (ctx, req) => {

    const userId = ctx.userClaims?.id;

    if (!userId) {
      return Response.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const { data: user, error } = await ctx.supabase
      .from("users")
      .select("*, user_type_id(name)")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return handler({ user, ctx, req });

  });

};
