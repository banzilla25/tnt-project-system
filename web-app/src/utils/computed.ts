import { CreatorSnapshot, CampaignCreator, Video } from '@/types/database';

export const getCreatorType = (audience_age: string | null): 'Nano' | 'Micro' | 'Macro' | 'Mega' | 'Unknown' => {
  return 'Unknown'; // Karena kita tidak lagi menggunakan angka follower, default ke Unknown atau ambil dari Tier.
}


export const getLatestSnapshot = (snapshots: CreatorSnapshot[], creatorId: number): CreatorSnapshot | null => {
  const creatorSnapshots = snapshots.filter(s => s.creator_id === creatorId);
  if (creatorSnapshots.length === 0) return null;
  // sort by date descending
  return creatorSnapshots.sort((a, b) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime())[0];
};

export const computeCampaignGMV = (cc: CampaignCreator, videos?: Video[], sales?: any[]): number => {
  let dynamicGMV = 0;
  
  if (videos && sales) {
    const ccVideos = videos.filter(v => v.campaign_creator_id === cc.id && v.content_uid);
    const contentUids = ccVideos.map(v => v.content_uid);
    if (contentUids.length > 0) {
      dynamicGMV = sales.filter(s => contentUids.includes(s.content_uid)).reduce((sum, row) => sum + (row.gmv || 0), 0);
    }
  }

  // Sesuai instruksi: Mengabaikan data legacy dari Excel. Murni 100% bergantung pada data organik.
  return dynamicGMV;
};

export const getJenisKerjasama = (price: number): 'barter' | 'ratecard' => {
  return price === 0 ? 'barter' : 'ratecard';
};

export const computeHighestVideoGMV = (cc: CampaignCreator, videos?: Video[], sales?: any[]): number => {
  let highest = 0;
  if (videos && sales) {
    const ccVideos = videos.filter(v => v.campaign_creator_id === cc.id && v.content_uid);
    for (const v of ccVideos) {
      const gmv = sales.filter(s => s.content_uid === v.content_uid).reduce((sum, row) => sum + (row.gmv || 0), 0);
      if (gmv > highest) highest = gmv;
    }
  }
  return highest;
};
