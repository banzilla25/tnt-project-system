const fs = require('fs');

const path = 'src/app/campaigns/[id]/daily/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove if (!isAwareness) for fetching sales
const oldFetchSales = `      // 1. Fetch Sales (for Non-Awareness)
      if (!isAwareness) {
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
          const { data: salesData, error } = await supabase
            .from('sales')
            .select('tanggal, gmv, creator_username, content_uid')
            .eq('campaign_id', campaignId)
            .eq('is_refund', false)
            .range(from, to);

          if (error) {
            console.error("Error fetching sales:", error);
            break;
          }

          if (salesData && salesData.length > 0) {
            allSales = [...allSales, ...salesData];
            if (salesData.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            hasMore = false;
          }
        }
      }`;
const newFetchSales = `      // 1. Fetch Sales (Now always fetched because Auto-VT uses sales table for all campaign types)
      let from = 0;
      let to = 999;
      let hasMore = true;
      while (hasMore) {
        const { data: salesData, error } = await supabase
          .from('sales')
          .select('tanggal, gmv, creator_username, content_uid')
          .eq('campaign_id', campaignId)
          .eq('is_refund', false)
          .range(from, to);

        if (error) {
          console.error("Error fetching sales:", error);
          break;
        }

        if (salesData && salesData.length > 0) {
          allSales = [...allSales, ...salesData];
          if (salesData.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        } else {
          hasMore = false;
        }
      }`;
content = content.replace(oldFetchSales, newFetchSales);


// 2. Remove if (!isAwareness) for grouping sales
const oldGroupSales = `      if (!isAwareness && allSales.length > 0) {`;
const newGroupSales = `      if (allSales.length > 0) {`;
content = content.replace(oldGroupSales, newGroupSales);


// 3. Add pagination states
const oldStates = `  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);`;
const newStates = `  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;`;
content = content.replace(oldStates, newStates);


// 4. Calculate pagination variables
const oldVars = `  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';`;
const newVars = `  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';
  
  const totalPages = Math.ceil(dailyData.length / pageSize);
  const paginatedDaily = React.useMemo(() => {
    return dailyData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [dailyData, currentPage]);`;
content = content.replace(oldVars, newVars);


// 5. Change mapping
const oldMap = `              ) : (
                dailyData.map((d, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-slate-50/50">`;
const newMap = `              ) : (
                paginatedDaily.map((d, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-slate-50/50">`;
content = content.replace(oldMap, newMap);


// 6. Add pagination UI
const tableEnd = `              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
const newTableEnd = `              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, dailyData.length)} dari {dailyData.length} hari
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

      </div>
    </div>`;
content = content.replace(tableEnd, newTableEnd);

fs.writeFileSync(path, content);
console.log('Fixed daily page awareness logic and added pagination');
