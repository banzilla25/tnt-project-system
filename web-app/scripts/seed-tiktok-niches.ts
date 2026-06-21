import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const newNiches = [
  "Menswear & Underwear",
  "Luggage & Bags",
  "Virtual Products",
  "Pre-Owned",
  "Collectibles",
  "Jewelry Accessories & Derivatives",
  "Bookings & Vouchers",
  "Sports & Outdoor",
  "Toys & Hobbies",
  "Furniture",
  "Tools & Hardware",
  "Home Improvement",
  "Automotive & Motorcycle",
  "Fashion Accessories",
  "Home Supplies",
  "Kitchenware",
  "Textiles & Soft Furnishings",
  "Household Appliances",
  "Womenswear & Underwear",
  "Muslim Fashion",
  "Shoes",
  "Beauty & Personal Care",
  "Phones & Electronics",
  "Computers & Office Equipment",
  "Pet Supplies",
  "Baby & Maternity",
  "Food & Beverages",
  "Health",
  "Books, Magazines & Audio",
  "Kids' Fashion"
];

async function seed() {
  const { data: existing } = await supabase.from('niches').select('nama');
  const existingSet = new Set((existing || []).map(n => n.nama.toLowerCase()));
  
  const toInsert = newNiches.filter(n => !existingSet.has(n.toLowerCase())).map(n => ({ nama: n }));
  
  if (toInsert.length > 0) {
    const { error } = await supabase.from('niches').insert(toInsert);
    if (error) {
      console.error("Error inserting:", error);
    } else {
      console.log(`Successfully inserted ${toInsert.length} new niches!`);
    }
  } else {
    console.log("No new niches to insert.");
  }
}

seed();
