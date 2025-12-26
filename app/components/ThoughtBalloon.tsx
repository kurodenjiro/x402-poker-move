"use client";

import { motion, AnimatePresence } from "motion/react";

interface ThoughtBalloonProps {
    text: string;
    isVisible: boolean;
    position?: "top" | "bottom" | "left" | "right";
}

export default function ThoughtBalloon({
    text,
    isVisible,
    position = "top",
}: ThoughtBalloonProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className={`absolute z-20 max-w-[200px] w-max pointer-events-none 
            ${position === "top" ? "-top-4 -translate-y-full left-1/2 -translate-x-1/2" : ""}
            ${position === "bottom" ? "-bottom-4 translate-y-full left-1/2 -translate-x-1/2" : ""}
          `}
                >
                    <div className="bg-white text-dark-1 text-xs 2xl:text-sm font-medium p-3 rounded-xl shadow-lg relative border-2 border-dark-1">
                        {/* Balloon Tail */}
                        <div
                            className={`absolute w-3 h-3 bg-white border-r-2 border-b-2 border-dark-1 transform rotate-45
              ${position === "top" ? "-bottom-1.5 left-1/2 -translate-x-1/2" : ""}
              ${position === "bottom" ? "-top-1.5 left-1/2 -translate-x-1/2 rotate-[225deg]" : ""}
              `}
                        />

                        {/* Thought Dots (optional, for "thinking" vibe) */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col gap-1 items-center opacity-0">
                            {/* Could add little bubbles here if we wanted a true comic style */}
                        </div>

                        <p className="relative z-10 leading-tight">
                            {text.length > 80 ? text.substring(0, 80) + "..." : text}
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
