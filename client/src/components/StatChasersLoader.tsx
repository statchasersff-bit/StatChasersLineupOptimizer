import { motion } from "framer-motion";

interface StatChasersLoaderProps {
  message?: string;
}

export function StatChasersLoader({ message = "Analyzing lineups..." }: StatChasersLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12" data-testid="loader-statchasers">
      {/* Animated Playbook */}
      <div className="relative w-32 h-32 mb-6">
        {/* Football field outline */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 120">
          {/* Field perimeter */}
          <motion.rect
            x="20"
            y="30"
            width="80"
            height="60"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary/40"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Yard lines */}
          <motion.line
            x1="60"
            y1="30"
            x2="60"
            y2="90"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2,2"
            className="text-primary/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Animated play routes - X's and O's */}
          {/* Player 1 (O) */}
          <motion.circle
            cx="40"
            cy="70"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-secondary"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.5,
              repeat: Infinity,
              repeatDelay: 1.5,
            }}
          />
          
          {/* Player 2 (O) */}
          <motion.circle
            cx="80"
            cy="70"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-secondary"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.7,
              repeat: Infinity,
              repeatDelay: 1.5,
            }}
          />
          
          {/* Route 1 - curved path */}
          <motion.path
            d="M 40 70 Q 45 55 55 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-primary"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 1, 1, 0] }}
            transition={{
              duration: 2,
              delay: 1,
              repeat: Infinity,
              repeatDelay: 0,
              ease: "easeInOut",
            }}
          />
          
          {/* Route 2 - curved path */}
          <motion.path
            d="M 80 70 Q 75 55 65 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-primary"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 1, 1, 0] }}
            transition={{
              duration: 2,
              delay: 1.2,
              repeat: Infinity,
              repeatDelay: 0,
              ease: "easeInOut",
            }}
          />
          
          {/* Defender X's */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 2,
              delay: 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <line x1="48" y1="48" x2="54" y2="54" stroke="currentColor" strokeWidth="2" className="text-red-500/60" />
            <line x1="54" y1="48" x2="48" y2="54" stroke="currentColor" strokeWidth="2" className="text-red-500/60" />
            
            <line x1="66" y1="48" x2="72" y2="54" stroke="currentColor" strokeWidth="2" className="text-red-500/60" />
            <line x1="72" y1="48" x2="66" y2="54" stroke="currentColor" strokeWidth="2" className="text-red-500/60" />
          </motion.g>
        </svg>
      </div>

      {/* Loading text */}
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-lg font-bold text-foreground">{message}</h3>
        <div className="flex items-center justify-center gap-1">
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-secondary"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.4,
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Drawing up your best lineups...
        </p>
      </motion.div>
    </div>
  );
}
