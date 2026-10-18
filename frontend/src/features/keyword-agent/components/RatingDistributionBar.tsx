import React from "react";
import { Star, ShieldCheck, TrendingUp } from "lucide-react";
import type { CompetitorTitle, PlatformName } from "../types";

interface RatingDistributionBarProps {
  competitors: CompetitorTitle[];
  platform: PlatformName;
}

export const RatingDistributionBar: React.FC<RatingDistributionBarProps> = ({
  competitors,
  platform,
}) => {
  if (!competitors || competitors.length === 0) {
    return null;
  }

  // Calculate rating buckets from competitors
  const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalRatings = 0;
  let sumScore = 0;
  let ratedCount = 0;

  for (const c of competitors) {
    if (c.rating && c.rating > 0) {
      ratedCount++;
      sumScore += c.rating;
      if (c.rating >= 4.5) buckets[5]++;
      else if (c.rating >= 3.8) buckets[4]++;
      else if (c.rating >= 3.0) buckets[3]++;
      else if (c.rating >= 2.0) buckets[2]++;
      else buckets[1]++;
    }
    if (c.rating_count) {
      totalRatings += c.rating_count;
    }
  }

  const avgRating = ratedCount > 0 ? (sumScore / ratedCount).toFixed(1) : "4.1";
  const m = 10;
  const C = 4.0;
  // Bayesian weighted average
  const bayesianScore = ratedCount > 0
    ? (((ratedCount / (ratedCount + m)) * Number(avgRating)) + ((m / (ratedCount + m)) * C)).toFixed(2)
    : "4.05";

  const totalBucketItems = ratedCount || 1;
  const p5 = Math.round((buckets[5] / totalBucketItems) * 100);
  const p4 = Math.round((buckets[4] / totalBucketItems) * 100);
  const p3 = Math.round((buckets[3] / totalBucketItems) * 100);
  const p2 = Math.round((buckets[2] / totalBucketItems) * 100);
  const p1 = Math.max(0, 100 - (p5 + p4 + p3 + p2));

  return (
    <div className="p-3.5 rounded-xl border border-divider/80 bg-content1/80 backdrop-blur-xs flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{avgRating}</span>
          </div>
          <span className="text-xs text-default-500">Market Avg</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950/40 text-primary font-mono font-semibold border border-primary/20">
            Bayesian {bayesianScore}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-default-400 font-medium">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span>{totalRatings.toLocaleString()} sample reviews</span>
        </div>
      </div>

      {/* Stacked Horizontal Rating Bar */}
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-default-100 gap-0.5">
        <div
          style={{ width: `${p5}%` }}
          className="bg-emerald-500 transition-all duration-500"
          title={`5★: ${p5}%`}
        />
        <div
          style={{ width: `${p4}%` }}
          className="bg-teal-500 transition-all duration-500"
          title={`4★: ${p4}%`}
        />
        <div
          style={{ width: `${p3}%` }}
          className="bg-amber-400 transition-all duration-500"
          title={`3★: ${p3}%`}
        />
        <div
          style={{ width: `${p2}%` }}
          className="bg-orange-400 transition-all duration-500"
          title={`2★: ${p2}%`}
        />
        <div
          style={{ width: `${p1}%` }}
          className="bg-rose-500 transition-all duration-500"
          title={`1★: ${p1}%`}
        />
      </div>

      {/* Star Legend */}
      <div className="flex items-center justify-between text-[10px] font-medium text-default-400 px-0.5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> 5★ ({p5}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-500" /> 4★ ({p4}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> 3★ ({p3}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" /> 2★ ({p2}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> 1★ ({p1}%)
        </span>
      </div>
    </div>
  );
};
