const fs = require('fs');
let content = fs.readFileSync('src/app/campaigns/[id]/keuangan/BatchDetail.tsx', 'utf8');

content = content.replace(
    "{batch.status === 'pending_manager' && (profile?.role === 'manager' || profile?.role === 'executive') && item.final_status === 'pending' && (",
    "{(profile?.role === 'manager' || profile?.role === 'executive') && item.final_status === 'pending' && ("
);

content = content.replace(
    "{batch.status === 'pending_executive_1' && profile?.role === 'executive' && item.final_status === 'manager_approved' && (",
    "{profile?.role === 'executive' && item.final_status === 'manager_approved' && ("
);

content = content.replace(
    "{batch.status === 'pending_finance' && (profile?.role === 'finance' || profile?.role === 'executive') && item.final_status === 'executive_1_approved' && (",
    "{(profile?.role === 'finance' || profile?.role === 'executive') && item.final_status === 'executive_1_approved' && ("
);

content = content.replace(
    "{batch.status === 'pending_finance' && (profile?.role === 'finance' || profile?.role === 'executive') && getLogicalStatus(item) === 'finance_selected' && (",
    "{(profile?.role === 'finance' || profile?.role === 'executive') && getLogicalStatus(item) === 'finance_selected' && ("
);

content = content.replace(
    "{batch.status === 'pending_executive' && profile?.role === 'executive' && getLogicalStatus(item) === 'finance_selected' && (",
    "{profile?.role === 'executive' && getLogicalStatus(item) === 'finance_selected' && ("
);

// Also we should fix the group grouping for 'pending_finance_outstanding' so it doesn't fall into 'Menunggu Manager'
const oldGroupLogic = `    } else if (status === 'rejected' || status === 'cancelled') {
        groupedItems.rejected.push(item);
    } else {
        groupedItems.pending_manager.push(item);
    }`;

const newGroupLogic = `    } else if (status === 'rejected' || status === 'cancelled') {
        groupedItems.rejected.push(item);
    } else if (status === 'pending_finance_outstanding') {
        if (!groupedItems.pending_finance_outstanding) groupedItems.pending_finance_outstanding = [];
        groupedItems.pending_finance_outstanding.push(item);
    } else {
        groupedItems.pending_manager.push(item);
    }`;

content = content.replace(oldGroupLogic, newGroupLogic);

// Add group title for pending_finance_outstanding
const oldTitles = `      rejected: 'Ditolak / Dibatalkan'
    };`;
const newTitles = `      rejected: 'Ditolak / Dibatalkan',
      pending_finance_outstanding: 'Ditunda Finance (Outstanding)'
    };`;
content = content.replace(oldTitles, newTitles);

fs.writeFileSync('src/app/campaigns/[id]/keuangan/BatchDetail.tsx', content);
console.log("Patch applied.");
