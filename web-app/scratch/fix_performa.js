const fs = require('fs');

const path = 'src/app/campaigns/[id]/performa/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace the creatorStats calculation with a useMemo version
const oldCreatorStats = `  // Aggregate per creator using local data
  const creatorStats = localCreators.map(cc => {
    const creator = cc.creators;
    const username = creator?.username || 'Unknown';
    
    // Organic GMV: from SQL View
    const ccSales = salesSummary.find(s => s.creator_username === username);
    const gmvOrganic = ccSales?.gmv_organic || 0;
    const itemsSold = ccSales?.items_sold || 0;
    
    // Awareness: from SQL View
    const ccAwareness = awarenessSummary.find(a => a.creator_username === username);
    const videoViews = Number(ccAwareness?.total_views || 0);
    const videoLikes = Number(ccAwareness?.total_likes || 0);
    const trackedVideos = Number(ccAwareness?.total_videos || 0);

    // Ads GMV and Cost: ads_performance matched by creator_id
    const ccAds = adsPerf.filter(a => a.creator_id === creator?.id);
    const gmvAds = ccAds.reduce((sum, row) => sum + (row.gross_revenue_usd * row.kurs), 0);
    const costAds = ccAds.reduce((sum, row) => sum + (row.cost_usd * row.kurs), 0);
    
    const totalGmv = gmvOrganic + gmvAds;
    const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';
    
    const dbVideos = cc.videos || [];
    const autoSalesVideos = salesDataForVt.filter(s => s.creator_username === username);
    const uniqueUids = new Set<string>();
    let totalVtCount = dbVideos.length;
    
    autoSalesVideos.forEach(s => {
       if (!uniqueUids.has(s.content_uid)) {
           uniqueUids.add(s.content_uid);
           const existsInDb = dbVideos.some((v: any) => v.content_uid === s.content_uid);
           if (!existsInDb) {
               totalVtCount++;
           }
       }
    });
    
    const totalVt = isAwareness ? trackedVideos : totalVtCount;

    return {
      ccId: cc.id,
      creatorId: creator?.id,
      username,
      tier: cc.tier,
      price: cc.price,
      gmvOrganic,
      itemsSold,
      videoViews,
      videoLikes,
      trackedVideos,
      gmvAds,
      totalGmv,
      costAds,
      roas,
      totalVt
    };
  });`;

const newCreatorStats = `  // Aggregate per creator using local data (Optimized with useMemo & Maps)
  const creatorStats = React.useMemo(() => {
    const salesMap = new Map();
    salesSummary.forEach(s => salesMap.set(s.creator_username, s));

    const awarenessMap = new Map();
    awarenessSummary.forEach(a => awarenessMap.set(a.creator_username, a));

    const adsMap = new Map();
    adsPerf.forEach(a => {
      if (!adsMap.has(a.creator_id)) adsMap.set(a.creator_id, []);
      adsMap.get(a.creator_id).push(a);
    });

    const autoSalesMap = new Map();
    salesDataForVt.forEach(s => {
      if (!autoSalesMap.has(s.creator_username)) autoSalesMap.set(s.creator_username, []);
      autoSalesMap.get(s.creator_username).push(s);
    });

    return localCreators.map(cc => {
      const creator = cc.creators;
      const username = creator?.username || 'Unknown';
      
      const ccSales = salesMap.get(username);
      const gmvOrganic = ccSales?.gmv_organic || 0;
      const itemsSold = ccSales?.items_sold || 0;
      
      const ccAwareness = awarenessMap.get(username);
      const videoViews = Number(ccAwareness?.total_views || 0);
      const videoLikes = Number(ccAwareness?.total_likes || 0);
      const trackedVideos = Number(ccAwareness?.total_videos || 0);

      const ccAds = adsMap.get(creator?.id) || [];
      const gmvAds = ccAds.reduce((sum: number, row: any) => sum + (row.gross_revenue_usd * row.kurs), 0);
      const costAds = ccAds.reduce((sum: number, row: any) => sum + (row.cost_usd * row.kurs), 0);
      
      const totalGmv = gmvOrganic + gmvAds;
      const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';
      
      const dbVideos = cc.videos || [];
      const dbVideosSet = new Set(dbVideos.map((v: any) => v.content_uid));
      const autoSalesVideos = autoSalesMap.get(username) || [];
      const uniqueUids = new Set<string>();
      
      let totalVtCount = dbVideos.length;
      autoSalesVideos.forEach((s: any) => {
         if (!uniqueUids.has(s.content_uid)) {
             uniqueUids.add(s.content_uid);
             if (!dbVideosSet.has(s.content_uid)) {
                 totalVtCount++;
             }
         }
      });
      
      const totalVt = isAwareness ? trackedVideos : totalVtCount;

      return {
        ccId: cc.id,
        creatorId: creator?.id,
        username,
        tier: cc.tier,
        price: cc.price,
        gmvOrganic,
        itemsSold,
        videoViews,
        videoLikes,
        trackedVideos,
        gmvAds,
        totalGmv,
        costAds,
        roas,
        totalVt
      };
    });
  }, [localCreators, salesSummary, awarenessSummary, adsPerf, salesDataForVt, isAwareness]);`;

content = content.replace(oldCreatorStats, newCreatorStats);

// 2. Add pagination states right after sortOrder state
const oldSortOrder = `  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');`;
const newSortOrder = `  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortOrder]);`;
content = content.replace(oldSortOrder, newSortOrder);


// 3. Slice the filtered array before rendering and calculate totalPages
const oldFiltered = `    return sortOrder === 'asc' ? comparison : -comparison;
  });`;
const newFiltered = `    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredCreatorStats.length / pageSize);
  const paginatedStats = filteredCreatorStats.slice((currentPage - 1) * pageSize, currentPage * pageSize);`;
content = content.replace(oldFiltered, newFiltered);


// 4. Change map over filteredCreatorStats to map over paginatedStats
const oldMap = `              ) : (
                filteredCreatorStats.map((c) => (`
const newMap = `              ) : (
                paginatedStats.map((c) => (`
content = content.replace(oldMap, newMap);


// 5. Add Pagination controls below the table wrap
const tableWrapEnd = `              )}
            </tbody>
          </table>
        </div>
      </div>`;
const paginationHTML = `              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredCreatorStats.length)} dari {filteredCreatorStats.length} kreator
            </div>
            <div className="flex items-center gap-[8px]">
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >Sebelumnya</button>
              <span className="font-bold px-[8px] text-indigo-600">Hal {currentPage} / {totalPages}</span>
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >Selanjutnya</button>
            </div>
          </div>
        )}
      </div>`;
content = content.replace(tableWrapEnd, paginationHTML);

fs.writeFileSync(path, content);
console.log('Optimized performance table');
