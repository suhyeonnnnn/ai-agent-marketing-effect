import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ──────────────────────────────────────────────
//  Human Experiment Logging API
//  POST /api/human/log
//
//  Accepts data from the frontend and maps field names
//  to the Supabase schema. Handles both Study 1 and Study 2.
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "Missing type or data" }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    switch (type) {
      case "study1_trial": {
        const { error } = await supabase.from("study1_trials").insert({
          participant_id: data.participant_id,
          round: data.round,
          category_id: data.category || data.category_id,
          condition: data.condition,
          funnel: data.funnel || "vague",
          target_product_id: data.target_product_id,
          chosen_product_id: data.selected_product_id || data.chosen_product_id,
          chose_target: data.chose_target === 1 || data.chose_target === true,
          position_order: data.position_order,
          reaction_time_ms: data.response_time_ms || data.reaction_time_ms,
          timestamp: data.timestamp || timestamp,
        });
        if (error) throw error;
        break;
      }

      case "study2_trial": {
        const { error } = await supabase.from("study2_trials").insert({
          participant_id: data.participant_id,
          round: data.round,
          category_id: data.category || data.category_id,
          condition: data.condition,
          funnel: data.funnel || "vague",
          target_product_id: data.target_product_id,
          chosen_product_id: data.selected_product_id || data.chosen_product_id,
          chose_target: data.chose_target === 1 || data.chose_target === true,
          position_order: data.position_order,
          products_viewed: data.products_viewed || 0,
          reviews_read: data.reviews_read || 0,
          total_steps: data.total_steps || 0,
          page_visits: data.page_visits || [],
          time_per_page_ms: data.time_per_page_ms || [],
          reaction_time_ms: data.response_time_ms || data.reaction_time_ms,
          timestamp: data.timestamp || timestamp,
        });
        if (error) throw error;
        break;
      }

      case "survey": {
        const { error } = await supabase.from("survey_responses").insert({
          participant_id: data.participant_id,
          study_type: data.study_type,
          q1_attention_check: data.q1_attention_check || data.q5_attention_check,
          attention_check_passed: data.attention_check_passed,
          q2_important_factors: data.q2_important_factors || data.q1_important_factors,
          q3_shopping_frequency: data.q3_shopping_frequency || data.q2_shopping_frequency,
          q4_age: data.q4_age || data.q3_age,
          q5_gender: data.q5_gender || data.q4_gender,
          timestamp: data.timestamp || timestamp,
        });
        if (error) throw error;
        break;
      }

      case "assignment": {
        // Extract fields from the assignment object (which may have nested rounds)
        const conditions = data.rounds?.map((r: any) => r.condition) || data.conditions || [];
        const categories = data.rounds?.map((r: any) => r.categoryId) || data.categories || [];
        const funnels = data.rounds?.map((r: any) => r.funnel) || data.funnels || [];

        const { error } = await supabase.from("assignments").insert({
          participant_id: data.participantId || data.participant_id,
          study_type: data.studyType || data.study_type || "study1",
          conditions,
          categories,
          funnels,
          seed: data.seed,
          assignment_json: data,
          timestamp: data.timestamp || timestamp,
        });
        if (error) throw error;
        break;
      }

      case "study2_browsing": {
        const { error } = await supabase.from("study2_browsing").insert({
          participant_id: data.participant_id,
          round: data.round,
          category_id: data.category || data.category_id,
          condition: data.condition,
          page_type: data.page_type,
          product_id: data.product_id,
          enter_time: data.enter_time,
          exit_time: data.exit_time,
          duration_ms: data.duration_ms,
          action: data.action,
        });
        if (error) throw error;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, timestamp });
  } catch (err: any) {
    console.error("Logging error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
