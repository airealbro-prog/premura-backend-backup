import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendDiscordAlert(message: string) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `⚠️ Disposition Webhook:\n${message}` }),
    });
  } catch (err) {
    console.error("Discord alert failed:", err);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    console.log("=== DISPOSITION WEBHOOK RECEIVED ===");

    const rawBody = await req.text();
    console.log("Raw body:", rawBody);

    let payload: Record<string, unknown>;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params.entries());
    } else {
      payload = JSON.parse(rawBody);
    }

    console.log("Parsed payload keys:", Object.keys(payload));

    // Normalize GHL customData (can be array or object)
    const rawCustomData = payload.customData ?? payload.custom_data;
    let cd: Record<string, string> = {};
    if (Array.isArray(rawCustomData)) {
      for (const item of rawCustomData) {
        const obj = item as Record<string, string>;
        const key = obj.field_key || obj.key || obj.id || "";
        if (key) cd[key] = obj.value ?? "";
      }
    } else if (rawCustomData && typeof rawCustomData === "object") {
      cd = rawCustomData as Record<string, string>;
    }

    console.log("Custom data keys:", Object.keys(cd));

    // Helper: return first non-null value
    const first = (...vals: unknown[]): string | null => {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
      }
      return null;
    };

    // Extract phone number (primary lookup key)
    const phoneNumber = first(
      payload.phone, payload.phone_number,
      cd["phone_number"], cd["phone"],
    );

    if (!phoneNumber) {
      const msg = `No phone number in disposition payload. Keys: ${Object.keys(payload).join(", ")}`;
      console.error(msg);
      await sendDiscordAlert(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Looking up appointment by phone:", phoneNumber);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find most recent appointment matching this phone number
    const { data: appointments, error: queryError } = await supabase
      .from("appointments_new")
      .select("id, name, phone_number, setter_name, company_id")
      .eq("phone_number", phoneNumber.trim())
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      const msg = `Supabase query error: ${queryError.message}`;
      console.error(msg);
      await sendDiscordAlert(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!appointments || appointments.length === 0) {
      const msg = `No appointment found for phone: ${phoneNumber}`;
      console.warn(msg);
      await sendDiscordAlert(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const appointment = appointments[0];
    console.log(`Found appointment: id=${appointment.id}, name=${appointment.name}`);

    // Extract disposition fields from GHL form
    // GHL sends fields as human-readable top-level keys (e.g. "What was the disposition?")
    const dispositionStatus = first(
      payload["What was the disposition?"],
      payload["What's the confirmation disposition?"],
      cd["disposition"], cd["disposition_status"],
      payload.disposition, payload.disposition_status,
    );
    const systemSize = first(
      payload["System Size"],
      cd["system_size"], payload.system_size,
    );
    const dqReason = first(
      payload["DQ Reason/s"],
      cd["dq_reason"], payload.dq_reason,
    );
    const followUpDate = first(
      payload["When is the follow up?"],
      cd["follow_up_date"], payload.follow_up_date,
    );
    const rescheduleDate = first(
      payload["When is it rescheduled for?"],
      cd["reschedule_date"], payload.reschedule_date,
    );
    const rescheduleTime = first(
      cd["reschedule_time"], payload.reschedule_time,
    );
    const notes = first(
      payload["Extra Notes:"],
      payload["Confirmation Notes"],
      cd["notes"], cd["confirmation_notes"], payload.notes,
    );
    const product = first(cd["product"], payload.product);
    const jobSize = first(cd["job_size"], payload.job_size);
    const satDown = first(
      payload["Did the Appointment Sit Down?"],
      cd["sat_down"], payload.sat_down,
    );
    const closer = first(
      payload["Closer"],
      cd["closer"], payload.closer,
    );

    // Build update object (only include fields that have values)
    const updateData: Record<string, unknown> = {
      disposition_date: new Date().toISOString(),
    };

    if (dispositionStatus) updateData.disposition_status = dispositionStatus;
    if (systemSize) updateData.system_size = systemSize;
    if (dqReason) updateData.dq_reason = dqReason;
    if (followUpDate) updateData.follow_up_date = followUpDate;
    if (rescheduleDate) updateData.reschedule_date = rescheduleDate;
    if (rescheduleTime) updateData.reschedule_time = rescheduleTime;
    if (notes) updateData.disposition_notes = notes;
    if (product) updateData.product = product;
    if (jobSize) updateData.job_size = jobSize;
    if (closer) updateData.closer_name = closer;

    console.log("Updating appointment with:", JSON.stringify(updateData));

    const { error: updateError } = await supabase
      .from("appointments_new")
      .update(updateData)
      .eq("id", appointment.id);

    if (updateError) {
      const msg = `Update failed for appointment ${appointment.id}: ${updateError.message}`;
      console.error(msg);
      await sendDiscordAlert(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Disposition recorded for appointment:", appointment.id);
    return new Response(
      JSON.stringify({ success: true, appointmentId: appointment.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    await sendDiscordAlert(msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
