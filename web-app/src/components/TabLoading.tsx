import { Loader2 } from "lucide-react";

export default function TabLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-24 space-y-4 w-full min-h-[400px]">
      <Loader2 className="w-12 h-12 animate-spin text-p300" />
      <p className="text-text-soft font-medium animate-pulse text-[15px]">Mohon bersabar, sedang mengambil data...</p>
    </div>
  );
}
