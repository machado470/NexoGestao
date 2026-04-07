import { motion } from "framer-motion";

interface FlowLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  animated?: boolean;
}

export default function FlowLine({
  x1,
  y1,
  x2,
  y2,
  color = "#f97316",
  animated = true,
}: FlowLineProps) {
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        overflow: "visible",
      }}
    >
      {/* Background line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2"
        opacity="0.2"
      />

      {/* Animated line */}
      {animated && (
        <motion.line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth="2"
          initial={{ strokeDasharray: length, strokeDashoffset: length }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          opacity="0.6"
        />
      )}

      {/* Dot at start */}
      <motion.circle
        cx={x1}
        cy={y1}
        r="4"
        fill={color}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Dot at end */}
      <motion.circle
        cx={x2}
        cy={y2}
        r="4"
        fill={color}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />
    </svg>
  );
}
