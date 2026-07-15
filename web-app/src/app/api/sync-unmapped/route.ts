import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DatabaseSchema } from "@/types/database";

const supabase = createClient<DatabaseSchema>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { productId, campaignId } = await req.json();

    if (!productId || !campaignId) {
      return NextResponse.json({ error: "Missing productId or campaignId" }, { status: 400 });
    }

    // 1. Update Sales
    const { data: updatedSales, error: errSales } = await supabase
      .from('sales')
      .update({ campaign_id: campaignId } as any)
      .is('campaign_id', null)
      .eq('product_id', productId)
      .select('id');

    if (errSales) {
      console.error("Error syncing unmapped sales:", errSales);
      throw errSales;
    }

    // 2. Update Organic Videos
    const { data: updatedVideos, error: errVideos } = await supabase
      .from('organic_videos')
      .update({ campaign_id: campaignId } as any)
      .is('campaign_id', null)
      .eq('product_id', productId)
      .select('content_uid');

    if (errVideos) {
      console.error("Error syncing unmapped organic videos:", errVideos);
      throw errVideos;
    }

    return NextResponse.json({
      success: true,
      message: "Sync complete",
      updatedSalesCount: updatedSales?.length || 0,
      updatedVideosCount: updatedVideos?.length || 0
    });

  } catch (error: any) {
    console.error("Sync API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
