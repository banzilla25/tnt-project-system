import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TNT Campaign Management',
    short_name: 'TNT Project',
    description: 'Internal dashboard for TNT affiliate campaigns',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon-tnt-rounded.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
