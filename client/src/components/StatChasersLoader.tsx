import { motion } from "framer-motion";
import { TrendingUp, Activity } from "lucide-react";

interface StatChasersLoaderProps {
  message?: string;
}

export function StatChasersLoader({ message = "Analyzing lineups..." }: StatChasersLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12" data-testid="loader-statchasers">
      {/* Animated Football Icon */}
      <div className="relative w-24 h-24 mb-6">
        {/* Scanning effect - circular rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-primary/20"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-secondary/30"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.7, 0, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />
        
        {/* Center icon with bounce */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="relative">
            {/* Football shape */}
            <div className="w-16 h-16 bg-gradient-to-br from-amber-700 to-amber-900 rounded-full flex items-center justify-center shadow-lg">
              <div className="w-1 h-10 bg-white/80" />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-1">
                <div className="w-6 h-0.5 bg-white/80" />
              </div>
            </div>
            
            {/* Stat indicators */}
            <motion.div
              className="absolute -top-2 -right-2 bg-secondary text-primary rounded-full p-1.5 shadow-md"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <TrendingUp className="w-3 h-3" />
            </motion.div>
            
            <motion.div
              className="absolute -bottom-2 -left-2 bg-primary text-secondary rounded-full p-1.5 shadow-md"
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Activity className="w-3 h-3" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Loading text with shimmer */}
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
          Crunching numbers and optimizing lineups
        </p>
      </motion.div>
    </div>
  );
}
