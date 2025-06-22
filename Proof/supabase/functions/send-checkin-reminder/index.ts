import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  try {
    const { user_id, title, body } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch user's Expo push token from Supabase
    const supabaseUrl = Deno.env.get("PUBLIC_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SERVICE_SUPABASE_SERVICE_ROLE_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const userData = await userRes.json();

    if (!userData.length || !userData[0].expo_push_token) {
      return new Response(JSON.stringify({ error: "User or push token not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const expoPushToken = userData[0].expo_push_token;

    // Send push notification via Expo API
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          to: expoPushToken,
          sound: "default",
          title,
          body,
        },
      ]),
    });

    const result = await expoRes.json();

    return new Response(JSON.stringify({ status: "sent", result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
