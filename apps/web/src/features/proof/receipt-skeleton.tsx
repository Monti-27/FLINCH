import { Skeleton, SkeletonGroup } from "../../components/ui/skeleton.tsx";

export function ReceiptSkeleton() {
  return <SkeletonGroup label="Reading confirmed receipts">
    <div className="receipt-list" aria-hidden="true"><div className="receipt-placeholder">
      <Skeleton width="220px" height="14px" /><Skeleton width="180px" height="14px" /><Skeleton width="104px" height="14px" />
    </div></div>
  </SkeletonGroup>;
}
