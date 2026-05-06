import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface DispositionFormData {
  phone_number?: string;
  disposition?: string; // "Closed", "Not Interested", "Follow-up", "Rescheduled", "Disqualified"
  system_size?: string;
  dq_reason?: string;
  follow_up_date?: string;
  reschedule_date?: string;
  reschedule_time?: string;
  notes?: string;
  product?: string; // "solar" or "roofing"
}

async function sendDiscordAlert(message: string) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `⚠️ Disposition Webhook Error:\n${message}`,
      }),
    });
  } catch (err) {
    console.error("Failed to send Discord alert:", err);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Parse webhook payload from GHL form submission
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

    // Extract phone number from form data
    // GHL sends form data in different formats, so we check multiple fields
    const phoneNumber = payload.phone_number ||
                       payload.phone ||
                       payload.formData?.phone_number ||
                       payload.formData?.phone;

    if (!phoneNumber) {
      const errorMsg = "No phone number found in webhook payload";
      console.error(errorMsg);
      await sendDiscordAlert(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Find appointment by phone number
    const { data: appointments, error: queryError } = await supabase
      .from("appointments_new")
      .select("*")
      .eq("phone", phoneNumber.trim())
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      const errorMsg = `Supabase query failed: ${queryError.message}`;
      console.error(errorMsg);
      await sendDiscordAlert(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!appointments || appointments.length === 0) {
      const errorMsg = `No appointment found for phone: ${phoneNumber}`;
      console.warn(errorMsg);
      await sendDiscordAlert(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appointment = appointments[0];
    console.log(`Found appointment for ${phoneNumber}:`, appointment.id);

    // Build update payload from form data
    const updateData: any = {
      disposition_status: payload.disposition || payload.formData?.disposition,
      disposition_date: new Date().toISOString(),
    };

    // Add optional fields if present
    if (payload.system_size || payload.formData?.system_size) {
      updateData.system_size = payload.system_size || payload.formData?.system_size;
    }
    if (payload.dq_reason || payload.formData?.dq_reason) {
      updateData.dq_reason = payload.dq_reason || payload.formData?.dq_reason;
    }
    if (payload.follow_up_date || payload.formData?.follow_up_date) {
      updateData.follow_up_date = payload.follow_up_date || payload.formData?.follow_up_date;
    }
    if (payload.reschedule_date || payload.formData?.reschedule_date) {
      updateData.reschedule_date = payload.reschedule_date || payload.formData?.reschedule_date;
      updateData.reschedule_time = payload.reschedule_time || payload.formData?.reschedule_time;
    }
    if (payload.notes || payload.formData?.notes) {
      updateData.disposition_notes = payload.notes || payload.formData?.notes;
    }

    console.log("Updating appointment with:", updateData);

    // Update the appointment record
    const { data: updated, error: updateError } = await supabase
      .from("appointments_new")
      .update(updateData)
      .eq("id", appointment.id);

    if (updateError) {
      const errorMsg = `Update failed: ${updateError.message}`;
      console.error(errorMsg);
      await sendDiscordAlert(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Successfully updated appointment:", appointment.id);
    return new Response(
      JSON.stringify({
        success: true,
        appointmentId: appointment.id,
        message: "Disposition recorded",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    await sendDiscordAlert(errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
