const fs = require('fs');
const path = require('path');

let ccFile = path.join(__dirname, 'src/components/GlobalCommandCenter.tsx');
let ccContent = fs.readFileSync(ccFile, 'utf8');

ccContent = ccContent.replace(
  `import { bulkApproveManager, bulkApproveExecutive1, bulkApproveExecutiveFinal, bulkProcessFinanceReview } from '@/app/campaigns/actions/paymentActions';`,
  `import { bulkApproveManager, bulkApproveExecutive1, bulkApproveExecutiveFinal, bulkProcessFinanceReview } from '@/app/campaigns/actions/paymentActions';\nimport { getLogicalStatus } from '@/utils/statusHelper';`
);

ccContent = ccContent.replace(
  `        if (activeFunnel === 'pending_manager') {
          validItems = validItems.filter((i:any) => i.manager_status === 'pending');
        }
        if (activeFunnel === 'pending_executive_1') {
          validItems = validItems.filter((i:any) => ['manager_approved', 'executive_1_approved', 'finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.manager_status === 'approved'));
        }
        if (activeFunnel === 'pending_finance') {
          validItems = validItems.filter((i:any) => ['executive_1_approved', 'finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.executive_1_status === 'approved'));
        }
        if (activeFunnel === 'pending_executive') {
          validItems = validItems.filter((i:any) => ['finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.finance_selected));
        }
        if (activeFunnel === 'ready_to_pay') {
          validItems = validItems.filter((i:any) => i.final_status === 'finance_selected' || i.final_status === 'ready_to_pay');
        }
        if (activeFunnel === 'rejected') {
          validItems = validItems.filter((i:any) => i.final_status === 'rejected');
        }
        if (activeFunnel === 'semua') {
          validItems = validItems.filter((i:any) => ['pending', 'manager_approved', 'finance_selected'].includes(i.final_status));
        }`,
  `        if (activeFunnel === 'pending_manager') {
          validItems = validItems.filter((i:any) => getLogicalStatus(i) === 'pending' && i.manager_status === 'pending');
        }
        if (activeFunnel === 'pending_executive_1') {
          validItems = validItems.filter((i:any) => ['manager_approved', 'executive_1_approved', 'finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.manager_status === 'approved'));
        }
        if (activeFunnel === 'pending_finance') {
          validItems = validItems.filter((i:any) => ['executive_1_approved', 'finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.executive_1_status === 'approved'));
        }
        if (activeFunnel === 'pending_executive') {
          validItems = validItems.filter((i:any) => ['finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.finance_selected));
        }
        if (activeFunnel === 'ready_to_pay') {
          validItems = validItems.filter((i:any) => getLogicalStatus(i) === 'finance_selected' || getLogicalStatus(i) === 'ready_to_pay');
        }
        if (activeFunnel === 'rejected') {
          validItems = validItems.filter((i:any) => getLogicalStatus(i) === 'rejected');
        }
        if (activeFunnel === 'semua') {
          validItems = validItems.filter((i:any) => ['pending', 'manager_approved', 'finance_selected'].includes(getLogicalStatus(i)));
        }`
);

fs.writeFileSync(ccFile, ccContent);

let bdFile = path.join(__dirname, 'src/app/campaigns/[id]/keuangan/BatchDetail.tsx');
let bdContent = fs.readFileSync(bdFile, 'utf8');

bdContent = bdContent.replace(
  `import { CheckCircle2, AlertCircle, Clock, Check, X, Building2, User } from 'lucide-react';`,
  `import { CheckCircle2, AlertCircle, Clock, Check, X, Building2, User } from 'lucide-react';\nimport { getLogicalStatus } from '@/utils/statusHelper';`
);

bdContent = bdContent.replace(
  `    if (activeFunnel === 'pending_manager') return allItems.filter((i: any) => i.manager_status === 'pending');
    if (activeFunnel === 'pending_executive_1') return allItems.filter((i: any) => ['manager_approved', 'executive_1_approved', 'finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.manager_status === 'approved'));
    if (activeFunnel === 'pending_finance') return allItems.filter((i: any) => ['executive_1_approved', 'finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.executive_1_status === 'approved'));
    if (activeFunnel === 'pending_executive') return allItems.filter((i: any) => ['finance_selected', 'executive_approved', 'ready_to_pay', 'paid'].includes(i.final_status) || (i.final_status === 'rejected' && i.finance_selected));
    if (activeFunnel === 'ready_to_pay') return allItems.filter((i: any) => ['ready_to_pay', 'paid'].includes(i.final_status));
    if (activeFunnel === 'rejected') return allItems.filter((i: any) => i.final_status === 'rejected');
    return allItems.filter((i: any) => ['pending', 'manager_approved', 'finance_selected'].includes(i.final_status));`,
  `    if (activeFunnel === 'pending_manager') return allItems.filter((i: any) => getLogicalStatus(i) === 'pending' && i.manager_status === 'pending');
    if (activeFunnel === 'pending_executive_1') return allItems.filter((i: any) => ['manager_approved', 'executive_1_approved', 'finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.manager_status === 'approved'));
    if (activeFunnel === 'pending_finance') return allItems.filter((i: any) => ['executive_1_approved', 'finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.executive_1_status === 'approved'));
    if (activeFunnel === 'pending_executive') return allItems.filter((i: any) => ['finance_selected', 'ready_to_pay', 'paid'].includes(getLogicalStatus(i)) || (i.final_status === 'rejected' && i.finance_selected));
    if (activeFunnel === 'ready_to_pay') return allItems.filter((i: any) => ['ready_to_pay', 'paid'].includes(getLogicalStatus(i)));
    if (activeFunnel === 'rejected') return allItems.filter((i: any) => getLogicalStatus(i) === 'rejected');
    return allItems.filter((i: any) => ['pending', 'manager_approved', 'finance_selected'].includes(getLogicalStatus(i)));`
);

// We also need to fix `item.final_status === 'finance_selected'` checks in BatchDetail.tsx!
bdContent = bdContent.replace(
  `item.final_status === 'finance_selected'`,
  `getLogicalStatus(item) === 'finance_selected'`
);
bdContent = bdContent.replace(
  `item.final_status === 'finance_selected'`,
  `getLogicalStatus(item) === 'finance_selected'`
);
bdContent = bdContent.replace(
  `item.final_status === 'finance_selected'`,
  `getLogicalStatus(item) === 'finance_selected'`
);
bdContent = bdContent.replace(
  `item.final_status === 'finance_selected'`,
  `getLogicalStatus(item) === 'finance_selected'`
);

fs.writeFileSync(bdFile, bdContent);
console.log('UI files patched successfully');
