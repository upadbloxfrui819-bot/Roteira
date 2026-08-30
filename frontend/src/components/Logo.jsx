import React from "react";

export const LOGO_URL = "https://customer-assets-lqy194kg.emergentagent.net/job_content-maker-156/artifacts/qser7nnk_Logo%20Principal.png";

export const Logo = ({ size = 40, className = "" }) => (
  <img
    src={LOGO_URL}
    alt="Roteira"
    height={size}
    style={{ height: `${size}px`, width: "auto" }}
    className={`select-none ${className}`}
    draggable={false}
  />
);
