import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function fixBrands() {
  console.log("Fetching campaigns...");
  const { data: campaigns } = await supabase.from('campaigns').select('id, nama, brand_id');
  if (!campaigns) return;

  const brandNamesToCreate = [
    'ISWHITE', 'Kimme', 'Dioly', 'Qahira', 'NAISDAY', 'SYB', 
    'Ms Glow', 'Salsa', 'PWS', 'Skinmology', 'Glowies'
  ];

  console.log("Creating missing brands...");
  const { data: existing } = await supabase.from('brands').select('nama');
  const existingNames = new Set(existing?.map(e => e.nama.toLowerCase()) || []);
  
  for (const b of brandNamesToCreate) {
    if (!existingNames.has(b.toLowerCase())) {
        const { error } = await supabase.from('brands').insert({ nama: b, status: 'aktif' });
        if (error) console.error("Error creating brand", b, error);
    }
  }

  const { data: allBrands } = await supabase.from('brands').select('id, nama');
  const brandMap = new Map();
  allBrands?.forEach(b => brandMap.set(b.nama.toLowerCase(), b.id));

  console.log("Updating campaign brand_ids...");
  for (const camp of campaigns) {
    let newBrandId = camp.brand_id;
    const campNameLower = camp.nama.toLowerCase();

    if (campNameLower.includes('iswhite')) newBrandId = brandMap.get('iswhite');
    else if (campNameLower.includes('kimme')) newBrandId = brandMap.get('kimme');
    else if (campNameLower.includes('dioly')) newBrandId = brandMap.get('dioly');
    else if (campNameLower.includes('qahira')) newBrandId = brandMap.get('qahira');
    else if (campNameLower.includes('naisday')) newBrandId = brandMap.get('naisday');
    else if (campNameLower.includes('syb')) newBrandId = brandMap.get('syb');
    else if (campNameLower.includes('ms glow')) newBrandId = brandMap.get('ms glow');
    else if (campNameLower.includes('salsa')) newBrandId = brandMap.get('salsa');
    else if (campNameLower.includes('pws')) newBrandId = brandMap.get('pws');
    else if (campNameLower.includes('skinmology')) newBrandId = brandMap.get('skinmology');
    else if (campNameLower.includes('glowies')) newBrandId = brandMap.get('glowies');
    else if (campNameLower.includes('wardah')) newBrandId = brandMap.get('wardah');
    else if (campNameLower.includes('omg')) newBrandId = brandMap.get('omg skincare'); // default omg

    if (newBrandId && newBrandId !== camp.brand_id) {
      await supabase.from('campaigns').update({ brand_id: newBrandId }).eq('id', camp.id);
      console.log(`Updated campaign ${camp.nama} -> brand_id ${newBrandId}`);
    }
  }
  console.log("Brands fixed!");
}

fixBrands().catch(console.error);
