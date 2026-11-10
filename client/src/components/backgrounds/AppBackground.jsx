import React from "react";
import MicroSlats from "./MicroSlats";

/**
 * AppBackground — fixed, full-screen animated "Micro Slats" layer that sits
 * behind all content. Dark emerald slats on pure black, with a soft vignette
 * on top so foreground text and cards stay readable.
 */
export default function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none bg-black"
    >
      <MicroSlats
        preset="tide"
        color="#065F46"        /* emerald-800: dark green body */
        glintColor="#34D399"   /* brand-emerald-light crests */
        backgroundColor="#000000"
        slatWidth={8}
        slatHeight={22}
        gap={3}
        speed={0.45}
        glint={0.55}
        interactive={false}
      />
      {/* Readability veil: darken the centre/top where content lives */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_60%,rgba(0,0,0,0.1)_100%)]" />
    </div>
  );
}
