import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface PageFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const PageFade: React.FC<PageFadeProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    initial: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.2, // 200ms ease-out
        ease: "easeOut",
        delay,
      },
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -4,
      transition: {
        duration: shouldReduceMotion ? 0.05 : 0.15,
        ease: "easeIn",
      },
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
};
