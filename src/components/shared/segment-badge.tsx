import { SEGMENT_META } from "@/lib/types";
import type { CompanySegment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function SegmentBadge({ segment }: { segment: CompanySegment }) {
  return <Badge variant="outline">{SEGMENT_META[segment].label}</Badge>;
}
