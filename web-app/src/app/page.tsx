"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import Link from "next/link";
import { TrendingUp, Activity, Video, Users, DollarSign } from "lucide-react";

export default function Dashboard() {
  const { vw_campaign_summary } = useDatabaseStore();

  const getCountdown = (endDateStr: string) => {
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return 'Selesai';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} Hari Lagi`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Main Dashboard</h1>
        <p className="text-slate-500">Ringkasan performa seluruh campaign aktif.</p>
      </div>

      {vw_campaign_summary.length === 0 ? (
        <Card className="p-8 text-center bg-slate-50">
          <p className="text-slate-500">Belum ada data campaign atau database belum disinkronisasi.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Campaign Aktif</p>
                    <h3 className="text-2xl font-bold mt-2">{vw_campaign_summary.filter(c => c.status === 'aktif').length}</h3>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total GMV (All)</p>
                    <h3 className="text-2xl font-bold mt-2 text-green-600">
                      Rp {(vw_campaign_summary.reduce((a, b) => a + (b.total_gmv_achievement || 0), 0) / 1000000).toFixed(1)}M
                    </h3>
                    <p className="text-[10px] font-semibold text-green-600/80 mt-1">
                      Rp {vw_campaign_summary.reduce((a, b) => a + (b.total_gmv_achievement || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Video Tayang</p>
                    <h3 className="text-2xl font-bold mt-2">{vw_campaign_summary.reduce((a, b) => a + (b.achievement_video || 0), 0)}</h3>
                  </div>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Video className="w-5 h-5" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Sisa Budget Ads</p>
                    <h3 className="text-2xl font-bold mt-2 text-amber-600">
                      Rp {(vw_campaign_summary.reduce((a, b) => a + (b.sisa_budget_ads || 0), 0) / 1000000).toFixed(1)}M
                    </h3>
                    <p className="text-[10px] font-semibold text-amber-600/80 mt-1">
                      Rp {vw_campaign_summary.reduce((a, b) => a + (b.sisa_budget_ads || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table Detail */}
          <Card>
            <CardHeader>
              <CardTitle>Performa per Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Countdown</TableHead>
                    <TableHead className="text-right">Achievement GMV</TableHead>
                    <TableHead className="text-right">% Capai</TableHead>
                    <TableHead className="text-right">Video</TableHead>
                    <TableHead className="text-right">Sisa Ads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vw_campaign_summary.map((c) => {
                    const percentGmv = c.target_gmv ? Math.round(((c.total_gmv_achievement || 0) / c.target_gmv) * 100) : 0;
                    const percentVideo = c.target_video ? Math.round(((c.achievement_video || 0) / c.target_video) * 100) : 0;
                    
                    return (
                      <TableRow key={c.campaign_id}>
                        <TableCell>
                          <Link href={`/campaigns/${c.campaign_id}/listing`} className="font-semibold text-blue-600 hover:underline">
                            {c.nama}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.tipe_campaign === 'sales' ? 'success' : 'default'} className="uppercase text-[10px]">
                            {c.tipe_campaign}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCountdown(c.end_date) === 'Selesai' ? 'text-slate-400' : 'text-amber-600 border-amber-200 bg-amber-50'}>
                            {getCountdown(c.end_date)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          Rp {(c.total_gmv_achievement || 0).toLocaleString()}
                          <div className="text-xs text-slate-400 font-normal">Target: {c.target_gmv ? `Rp ${c.target_gmv.toLocaleString()}` : '-'}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-bold ${percentGmv >= 100 ? 'text-green-600' : 'text-slate-700'}`}>
                            {percentGmv}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{c.achievement_video || 0} <span className="text-slate-400 text-xs">/ {c.target_video || '-'}</span></div>
                          <div className="text-xs text-slate-400">{percentVideo}%</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={(c.sisa_budget_ads || 0) < 0 ? 'text-red-500' : 'text-slate-700'}>
                            Rp {(c.sisa_budget_ads || 0).toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
