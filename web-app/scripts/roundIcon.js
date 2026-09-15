const sharp = require('sharp');
const fs = require('fs');

async function roundImage() {
  const input = 'public/icon-tnt-project-tracking1.png';
  const size = 800;
  const radius = 160; // 20% border radius is standard for iOS/modern apps

  // Create an SVG mask for the rounded corners
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`
  );

  await sharp(input)
    .resize(size, size)
    .composite([{
      input: roundedCorners,
      blend: 'dest-in'
    }])
    .png()
    .toFile('src/app/icon.png');

  // Also save to public for the PWA manifest
  await sharp(input)
    .resize(512, 512)
    .composite([{
      input: Buffer.from(`<svg><rect x="0" y="0" width="512" height="512" rx="102" ry="102"/></svg>`),
      blend: 'dest-in'
    }])
    .png()
    .toFile('public/icon-tnt-rounded.png');
    
  console.log("Images rounded and saved!");
}

roundImage().catch(console.error);
