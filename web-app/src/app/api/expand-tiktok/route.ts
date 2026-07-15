import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { shortUrl } = await request.json();

    if (!shortUrl || !shortUrl.includes('vt.tiktok.com')) {
      return NextResponse.json({ error: 'Bukan link vt.tiktok.com yang valid' }, { status: 400 });
    }

    // Lakukan HTTP HEAD request untuk mendapatkan URL asli (redirect location)
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow', // Fetch will automatically follow redirects and populate response.url
    });

    const finalUrl = response.url;

    if (!finalUrl || finalUrl === shortUrl) {
       return NextResponse.json({ error: 'Gagal mendapatkan link asli' }, { status: 400 });
    }

    return NextResponse.json({ 
      originalUrl: shortUrl,
      expandedUrl: finalUrl
    });

  } catch (error: any) {
    console.error('Error expanding TikTok URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
