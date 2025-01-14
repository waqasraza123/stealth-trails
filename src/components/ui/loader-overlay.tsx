import React from "react";

export const LoaderOverlay: React.FC = () => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="animate-spin h-8 w-8 border-4 border-t-transparent rounded-full border-white"></div>
  </div>
);
