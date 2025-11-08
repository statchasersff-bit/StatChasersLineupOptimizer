import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

export function StatChasersWatermark() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center gap-1.5 mt-4 watermark"
      data-testid="watermark-statchasers"
    >
      <TrendingUp className="w-3 h-3" />
      <span>Powered by StatChasers</span>
    </motion.div>
  );
}
