import { NextRequest, NextResponse } from "next/server";
import { syncUnmappedForProduct, syncAllUnmappedGlobal } from "@/lib/syncUnmapped";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { productId, campaignId, syncAll } = body;

    if (syncAll) {
      const globalRes = await syncAllUnmappedGlobal();
      return NextResponse.json(globalRes);
    }

    if (!productId || !campaignId) {
      return NextResponse.json({ error: "Missing productId or campaignId" }, { status: 400 });
    }

    const res = await syncUnmappedForProduct(productId, campaignId);
    return NextResponse.json({
      success: true,
      message: "Sync complete",
      updatedSalesCount: res.salesUpdated,
      updatedVideosCount: res.videosUpdated,
      creatorsAdded: res.creatorsAdded
    });

  } catch (error: any) {
    console.error("Sync API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
