import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Trash2, Edit2, Loader2 } from "lucide-react";
import { formatAbbreviated } from "@/utils/formatters";
import { getCreatorType, getJenisKerjasama } from "@/utils/computed";
import { MultiSelect } from "@/components/MultiSelect";
import { NotesTimeline } from "@/components/NotesTimeline";

const areEqual = (prev: any, next: any) => {
  return (
    prev.isExpanded === next.isExpanded &&
    prev.hasPending === next.hasPending &&
    prev.pendingChange === next.pendingChange &&
    prev.activeEditingField === next.activeEditingField &&
    prev.isSelected === next.isSelected &&
    prev.isBatchSaving === next.isBatchSaving &&
    prev.cc === next.cc &&
    prev.creatorVideos === next.creatorVideos &&
    prev.hasAccess === next.hasAccess
  );
};

export const CreatorRow = React.memo(({
  cc,
  index,
  creator,
  snapshot,
  hasPending,
  pendingChange,
  isExpanded,
  activeEditingField,
  creatorVideos,
  hasAccess,
  isSelected,
  toggleSelectCreator,
  toggleExpand,
  setEditingCellId,
  setCellChange,
  getPendingValue,
  campaignSkus,
  setNicheEditCreatorId,
  setNicheEditForm,
  setNicheModalOpen,
  staffProfiles,
  isClientApprovalRequired,
  profile,
  isBatchSaving,
  handleDeleteCreator,
  updateCampaignCreator,
  fetchListing,
  page
}: any) => {
  return (
    <React.Fragment>
      <tr className={`group transition-colors ${hasPending ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-[#f8fafc]'}`}>
        <td className="text-center">
          {hasAccess && (
            <input 
              type="checkbox" 
              className="rounded border-slate-300 text-p300 focus:ring-p300 cursor-pointer w-4 h-4"
              checked={isSelected}
              onChange={() => toggleSelectCreator(cc.id)}
            />
          )}
        </td>
        <td>
          <button onClick={() => toggleExpand(cc.id)} className="p-[4px] hover:bg-slate-200 rounded">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-text-soft" /> : <ChevronRight className="w-4 h-4 text-text-soft" />}
          </button>
        </td>
        <td className="text-center font-medium text-[13px] text-text-soft">
          {index + 1}
        </td>
        <td>
          <div className="flex items-center gap-[8px]">
            <Link href={`/creator-pool/${creator.id}`} className="font-semibold text-p300 hover:underline block">
              @{creator.username}
            </Link>
            {cc.tier === 'Auto-Detect' && <span className="px-[6px] py-[2px] bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full">AUTO</span>}
          </div>
          <a href={creator.link_account || `https://www.tiktok.com/@${creator.username}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-[4px] hover:opacity-80 transition-opacity">
            <img src="/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-[26px]" />
          </a>
        </td>
        <td className="text-right">
          {activeEditingField === `followers` ? (
            <input 
              type="number" 
              min="0"
              autoFocus
              defaultValue={getPendingValue(cc.id, 'followers', snapshot?.followers || 0)}
              onBlur={e => { setCellChange(cc.id, 'followers', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-20 !p-[4px] text-right text-[13px]"
            />
          ) : (
            <span 
              className={`text-[13px] font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.followers !== undefined ? 'text-amber-700' : 'text-text'}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-followers`)}
            >{formatAbbreviated(getPendingValue(cc.id, 'followers', snapshot?.followers || 0) as number, false)}</span>
          )}
        </td>
        <td className="text-right text-[13px] font-medium text-text">
          {(() => {
            const f = getPendingValue(cc.id, 'followers', snapshot?.followers);
            if (f !== undefined && f !== null) {
              const numF = Number(f);
              if (numF < 10000) return 'Nano';
              if (numF < 100000) return 'Micro';
              if (numF < 1000000) return 'Macro';
              return 'Mega';
            }
            return snapshot?.tier || '-';
          })()}
        </td>
        <td className="text-center">
          {activeEditingField === `level` ? (
            <input 
              type="number" 
              min="1"
              autoFocus
              defaultValue={getPendingValue(cc.id, 'level', snapshot?.level || '')}
              onBlur={e => { setCellChange(cc.id, 'level', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-16 !p-[4px] text-center text-[13px]"
            />
          ) : (
            <span 
              className={`text-[13px] font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.level !== undefined ? 'text-amber-700' : 'text-text'}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-level`)}
            >{(getPendingValue(cc.id, 'level', snapshot?.level || '') as string) || '-'}</span>
          )}
        </td>
        <td>
          <div className="flex items-center gap-1 max-w-[200px]">
            <div className="flex flex-wrap gap-1">
              {creator.creator_niches?.map((cn: any, idx: number) => (
                cn.niches?.nama ? <span key={idx} className="bg-slate-100 text-slate-600 px-[6px] py-[2px] rounded text-[10px] whitespace-nowrap">{cn.niches.nama}</span> : null
              ))}
              {(!creator.creator_niches || creator.creator_niches.length === 0) && (
                <span className="text-slate-400 text-[10px] italic">Kosong</span>
              )}
            </div>
            {hasAccess && (
              <button 
                onClick={() => {
                  setNicheEditCreatorId(creator.id);
                  setNicheEditForm(creator.creator_niches?.map((cn: any) => cn.niche_id) || []);
                  setNicheModalOpen(true);
                }}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                title="Edit Niche"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>
        <td>
          <div className="text-[12px] text-text">
            {cc.created_at ? new Date(cc.created_at).toLocaleDateString('id-ID') : '-'}
          </div>
          <div className="text-[11px] text-text-soft mt-[2px]">
            Oleh: {cc.added_by_profile?.nama || 'System'}
          </div>
        </td>
        <td className="capitalize text-[13px] font-medium">
          {getJenisKerjasama(getPendingValue(cc.id, 'price', cc.price) as number)}
        </td>
        <td>
          {activeEditingField === `price` ? (
            <input 
              type="number" 
              autoFocus
              defaultValue={getPendingValue(cc.id, 'price', cc.price)}
              onBlur={e => { setCellChange(cc.id, 'price', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-24 !p-[4px]"
            />
          ) : (
            <span 
              className={`text-[13px] font-semibold cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.price !== undefined ? 'text-amber-700' : 'text-text'}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-price`)}
            >Rp {(getPendingValue(cc.id, 'price', cc.price) as number).toLocaleString()}</span>
          )}
        </td>
        <td>
          {activeEditingField === `qty_vt` ? (
            <input 
              type="number" 
              min="1"
              autoFocus
              defaultValue={getPendingValue(cc.id, 'qty_vt', cc.qty_vt)}
              onBlur={e => { setCellChange(cc.id, 'qty_vt', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-16 !p-[4px] text-center"
            />
          ) : (
            <span 
              className={`text-[13px] font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.qty_vt !== undefined ? 'text-amber-700' : ''}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-qty_vt`)}
            >{getPendingValue(cc.id, 'qty_vt', cc.qty_vt)}</span>
          )}
        </td>
        <td>
          {activeEditingField === `qty_live` ? (
            <input 
              type="number" 
              min="0"
              autoFocus
              defaultValue={getPendingValue(cc.id, 'qty_live', cc.qty_live || 0)}
              onBlur={e => { setCellChange(cc.id, 'qty_live', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-16 !p-[4px] text-center"
            />
          ) : (
            <span 
              className={`text-[13px] font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.qty_live !== undefined ? 'text-amber-700' : ''}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-qty_live`)}
            >{getPendingValue(cc.id, 'qty_live', cc.qty_live || 0)}</span>
          )}
        </td>
        <td>
          {(() => {
            let derivedContentType = getPendingValue(cc.id, 'content_type', cc.content_type || '-');
            if (derivedContentType === '-' || !derivedContentType) {
              const qVt = Number(getPendingValue(cc.id, 'qty_vt', cc.qty_vt)) || 0;
              const qLive = Number(getPendingValue(cc.id, 'qty_live', cc.qty_live)) || 0;
              if (qVt >= 1 && qLive === 0) derivedContentType = 'Video';
              else if (qVt === 0 && qLive >= 1) derivedContentType = 'Live';
              else if (qVt >= 1 && qLive >= 1) derivedContentType = 'Video & Live';
            }

            return activeEditingField === `content_type` ? (
              <select
                autoFocus
                defaultValue={derivedContentType as string}
                onBlur={e => { setCellChange(cc.id, 'content_type', e.target.value, cc); setEditingCellId(null); }}
                className="select w-32 !p-[4px] text-[13px] !min-h-[28px]"
              >
                <option value="Video">Video</option>
                <option value="Live">Live</option>
                <option value="Video & Live">Video & Live</option>
              </select>
            ) : (
              <span 
                className={`text-[13px] font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.content_type !== undefined ? 'text-amber-700' : 'text-text'}`}
                onClick={() => hasAccess && setEditingCellId(`${cc.id}-content_type`)}
              >{derivedContentType as string}</span>
            );
          })()}
        </td>
        <td className="min-w-[150px]">
          {activeEditingField === `produk` ? (
             <div className="w-full">
              <MultiSelect 
                options={campaignSkus.map((s: any) => ({ id: s.id, label: s.nama_produk }))}
                selectedIds={(getPendingValue(cc.id, 'assigned_sku_ids', cc.assigned_sku_ids || []) as number[])}
                onChange={(ids: number[]) => { setCellChange(cc.id, 'assigned_sku_ids', ids, cc); }}
                placeholder="Pilih Produk..."
                emptyMessage="Belum ada produk"
              />
              <button onClick={() => setEditingCellId(null)} className="text-[10px] text-blue-600 mt-1 hover:underline">Tutup</button>
            </div>
          ) : (
             <div 
               className={`flex flex-wrap gap-1 cursor-pointer hover:bg-blue-50 rounded p-1 ${hasPending && pendingChange?.assigned_sku_ids !== undefined ? 'ring-1 ring-amber-300' : ''}`}
               onClick={() => hasAccess && setEditingCellId(`${cc.id}-produk`)}
             >
               {(() => {
                 const skuIds = getPendingValue(cc.id, 'assigned_sku_ids', cc.assigned_sku_ids || []) as number[];
                 return skuIds && skuIds.length > 0 ? (
                   skuIds.map((skuId: number) => {
                     const sku = campaignSkus.find((s: any) => s.id === skuId);
                     return sku ? <span key={skuId} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{sku.nama_produk}</span> : null;
                   })
                 ) : (
                   <span className="text-[11px] text-slate-400 italic">Belum di-set</span>
                 );
               })()}
             </div>
          )}
        </td>
        <td>
          {activeEditingField === `approval` ? (
            <select 
              autoFocus
              value={getPendingValue(cc.id, 'approval', cc.approval) as string}
              onChange={e => { setCellChange(cc.id, 'approval', e.target.value, cc); setEditingCellId(null); }}
              onBlur={() => setEditingCellId(null)}
              className="select !p-[4px]"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="alternate">Alternate</option>
              <option value="not_approved">Not Approved</option>
            </select>
          ) : (
            <div 
              className={`flex flex-col items-center cursor-pointer hover:bg-blue-50 rounded p-1 ${hasPending && pendingChange?.approval !== undefined ? 'ring-1 ring-amber-300' : ''}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-approval`)}
            >
              {(() => {
                const approvalVal = getPendingValue(cc.id, 'approval', cc.approval) as string;
                return (
                  <span className={`badge ${
                    approvalVal === 'approved' ? 'b-approved' : 
                    approvalVal === 'not_approved' ? 'b-rejected' : 
                    approvalVal === 'alternate' ? 'b-alternate' : 'b-pending'
                  }`}>
                    {approvalVal}
                  </span>
                );
              })()}
              {!hasPending && (cc.approval === 'approved' && cc.approved_by_profile) && (
                <div className="text-[10px] text-text-soft mt-1 leading-tight text-center">Oleh: {cc.approved_by_profile.nama}</div>
              )}
              {!hasPending && ((cc.approval === 'not_approved' || cc.approval === 'alternate') && cc.not_approved_by_profile) && (
                <div className="text-[10px] text-text-soft mt-1 leading-tight text-center">Oleh: {cc.not_approved_by_profile.nama}</div>
              )}
            </div>
          )}
        </td>
        {isClientApprovalRequired && (
          <td>
            {activeEditingField === `client_approval` ? (
              <select 
                autoFocus
                value={getPendingValue(cc.id, 'client_approval', cc.client_approval || 'not_required') as string}
                onChange={e => { setCellChange(cc.id, 'client_approval', e.target.value, cc); setEditingCellId(null); }}
                onBlur={() => setEditingCellId(null)}
                className="select !p-[4px]"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            ) : (
              <div className="flex flex-col items-center">
                <span 
                  className={`badge cursor-pointer hover:opacity-80 ${
                    (getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) === 'approved' ? 'b-success' : 
                    (getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) === 'rejected' ? 'b-destructive' : 'b-neutral'
                  } ${hasPending && pendingChange?.client_approval !== undefined ? 'ring-1 ring-amber-300' : ''}`}
                  onClick={() => hasAccess && setEditingCellId(`${cc.id}-client_approval`)}
                >
                  {(getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) === 'not_required' ? 'Pending' : (getPendingValue(cc.id, 'client_approval', cc.client_approval) as string)}
                </span>
                {hasPending && pendingChange?.client_approval !== undefined && (
                  <div className="text-[10px] text-amber-600 mt-1 flex items-center justify-center gap-1 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> {isBatchSaving ? 'Menyimpan...' : 'Menunggu save...'}
                  </div>
                )}
              </div>
            )}
          </td>
        )}
        <td className="text-right">
          {activeEditingField === `gmv_30d` ? (
            <input 
              type="number" 
              min="0"
              autoFocus
              defaultValue={getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0)}
              onBlur={e => { setCellChange(cc.id, 'gmv_30d', Number(e.target.value), cc); setEditingCellId(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="input w-24 !p-[4px] text-right text-[13px]"
            />
          ) : (
            <span 
              className={`text-[13px] font-semibold cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.gmv_30d !== undefined ? 'text-amber-700' : 'text-text'}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-gmv_30d`)}
            >
              {(getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0) as number) > 0 ? formatAbbreviated(getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0) as number, true) : '-'}
            </span>
          )}
        </td>
        <td className="text-right">
          {hasAccess ? (
            <div className="flex justify-end gap-[4px] transition-opacity">
              <button onClick={() => handleDeleteCreator(cc.id)} className="p-[6px] hover:bg-red-50 rounded" title="Hapus Creator">
                <Trash2 className="w-4 h-4 text-text-soft hover:text-red-600" />
              </button>
            </div>
          ) : null}
        </td>
      </tr>
      
      {/* Expandable Video Row */}
      {isExpanded && (
        <tr className="bg-slate-50 hover:bg-slate-50">
          <td></td>
          <td></td>
          <td colSpan={isClientApprovalRequired ? 9 : 8} className="p-0 border-b-0">
            <div className="py-[16px] pr-[16px]">
              <div className="bg-white border border-line rounded-[12px] p-[16px]">
                <h4 className="text-[12px] font-bold text-text-soft uppercase mb-[12px]">Daftar Video ({cc.qty_vt})</h4>
                {creatorVideos.length > 0 ? (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-text-soft border-b border-line">
                        <th className="font-semibold text-left pb-[8px] w-10">#</th>
                        <th className="font-semibold text-left pb-[8px]">Konsep</th>
                        <th className="font-semibold text-left pb-[8px]">Link Video</th>
                        <th className="font-semibold text-left pb-[8px] w-32">VT Approval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creatorVideos.map((v: any) => (
                        <tr key={v.id} className="border-b border-line last:border-0">
                          <td className="py-[8px]">{v.urutan}</td>
                          <td className="py-[8px]">{v.concept || '-'}</td>
                          <td className="py-[8px]">
                            {v.link_video ? (
                              <a href={v.link_video} target="_blank" rel="noreferrer" className="text-p300 hover:underline break-all">
                                {v.link_video}
                              </a>
                            ) : '-'}
                          </td>
                          <td className="py-[8px]">
                            <span className={`badge ${v.vt_approval === 'approved' ? 'b-success' : v.vt_approval === 'reject' ? 'b-destructive' : 'b-neutral'}`}>
                              {v.vt_approval}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  ) : (
                    <p className="text-[13px] text-text-soft text-center py-[8px]">Belum ada video ditambahkan.</p>
                  )}

                  {/* Tambahan Detail Sesuai Request */}
                  <div className="mt-[24px] pt-[16px] border-t border-line">
                    <h4 className="text-[12px] font-bold text-text-soft uppercase mb-[12px]">Detail & Catatan Kreator</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Status Pembayaran</h5>
                        <p className="text-[13px] font-semibold text-text capitalize">{cc.status_bayar || '-'}</p>
                        {activeEditingField !== null && <p className="text-[10px] text-text-soft italic mt-1">Dikelola via Tab Keuangan</p>}
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Progress Sample</h5>
                        {hasAccess ? (
                          <select 
                            value={cc.sample_progress || 'Done Req Sample'} 
                            onChange={async (e) => {
                              await updateCampaignCreator(cc.id, { sample_progress: e.target.value }, profile?.nama || 'System');
                              fetchListing(page, true);
                            }} 
                            className="select !p-[4px]"
                          >
                            <option value="Done Req Sample">Done Req Sample</option>
                            <option value="Sudah Proses Pengiriman">Sudah Proses Pengiriman</option>
                            <option value="Sampai">Sampai</option>
                            <option value="Kendala [FU!]">Kendala [FU!]</option>
                          </select>
                        ) : (
                          <span className={`badge ${
                            cc.sample_progress === 'Sampai' ? 'b-success' : 
                            cc.sample_progress === 'Kendala [FU!]' ? 'b-destructive' : 
                            cc.sample_progress === 'Sudah Proses Pengiriman' ? 'b-warning' : 'b-neutral'
                          }`}>
                            {cc.sample_progress || '-'}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-2">
                        <NotesTimeline 
                          title="Notes Manager" 
                          rawNotes={cc.notes_manager} 
                          hasAccess={hasAccess}
                          onSave={async (val) => {
                            await updateCampaignCreator(cc.id, { notes_manager: val }, profile?.nama || 'System');
                            fetchListing(page, true); // reload to show changes
                          }}
                        />
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                        <NotesTimeline 
                          title={`Notes PIC (${cc.pic_assist || 'Belum di-assign'})`} 
                          rawNotes={cc.notes_pic} 
                          hasAccess={hasAccess}
                          onSave={async (val) => {
                            await updateCampaignCreator(cc.id, { notes_pic: val }, profile?.nama || 'System');
                            fetchListing(page, true);
                          }}
                        />
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[8px]">Informasi Tracking</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-[8px] text-[12px]">
                          <div>
                            <span className="text-text-soft block mb-[2px]">Ditambahkan Oleh:</span>
                            <span className="font-semibold text-text">
                              {staffProfiles.find((p: any) => p.id === cc.added_by)?.nama || 'Unknown'}
                              {cc.created_at && <span className="text-text-soft font-normal ml-1">({new Date(cc.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})})</span>}
                            </span>
                          </div>
                          {cc.approval === 'approved' && cc.approved_by && (
                            <div>
                              <span className="text-text-soft block mb-[2px]">Di-approve Oleh:</span>
                              <span className="font-semibold text-green-600">
                                {staffProfiles.find((p: any) => p.id === cc.approved_by)?.nama || '-'} 
                                {cc.approved_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.approved_at).toLocaleDateString('id-ID')})</span>}
                              </span>
                            </div>
                          )}
                          {cc.approval === 'not_approved' && cc.not_approved_by && (
                            <div>
                              <span className="text-text-soft block mb-[2px]">Ditolak Oleh:</span>
                              <span className="font-semibold text-red-600">
                                {staffProfiles.find((p: any) => p.id === cc.not_approved_by)?.nama || '-'} 
                                {cc.not_approved_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.not_approved_at).toLocaleDateString('id-ID')})</span>}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}, areEqual);
