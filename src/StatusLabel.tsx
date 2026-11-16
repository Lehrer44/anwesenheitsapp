import type {Status} from './model';

export const statusArabic:Record<Status,string>={anwesend:'حضور',abwesend:'غياب',entschuldigt:'اعتذار'};

/** Arabic label above the German one, used in buttons and table cells. */
export default function StatusLabel({status}:{status:Status}){
 return <span className="status-label"><span className="status-label-ar" lang="ar" dir="rtl">{statusArabic[status]}</span><span className="status-label-de">{status}</span></span>;
}
