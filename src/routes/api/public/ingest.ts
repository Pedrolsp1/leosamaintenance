import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const payloadSchema = z.object({
  machine: z.string().min(1),
  running: z.boolean(),
  recorded_at: z.string().datetime().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Node-RED / MQTT bridge endpoint.
 * POST { "machine": "AK-01", "running": true, "tags": { "speed": 12.4 } }
 * Stores the reading and closes/opens run-stop periods when the state flips.
 */
export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = payloadSchema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        const { machine, running, recorded_at, tags } = parsed.data;
        const at = recorded_at ?? new Date().toISOString();

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: machineRow, error: machineError } = await supabase
          .from("machines")
          .select("id")
          .eq("code", machine)
          .maybeSingle();
        if (machineError) return Response.json({ error: machineError.message }, { status: 500 });
        if (!machineRow) return Response.json({ error: "Unknown machine code" }, { status: 404 });

        const { error: readingError } = await supabase.from("machine_readings").insert({
          machine_id: machineRow.id,
          running,
          recorded_at: at,
          tags: tags ?? {},
        });
        if (readingError) return Response.json({ error: readingError.message }, { status: 500 });

        const nextState = running ? "run" : "stop";
        const { data: open } = await supabase
          .from("machine_state_periods")
          .select("id, state")
          .eq("machine_id", machineRow.id)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!open || open.state !== nextState) {
          if (open) {
            await supabase
              .from("machine_state_periods")
              .update({ ended_at: at })
              .eq("id", open.id);
          }
          await supabase.from("machine_state_periods").insert({
            machine_id: machineRow.id,
            state: nextState,
            started_at: at,
          });
        }

        return Response.json({ ok: true, machine, state: nextState });
      },
    },
  },
});
