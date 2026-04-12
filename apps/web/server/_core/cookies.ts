import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  const isDevelopment = (process.env.NODE_ENV ?? "").toLowerCase() === "development";
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const isHttps = req.secure || forwardedProto === "https";

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isDevelopment ? false : isHttps,
  };
}
