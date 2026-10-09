import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

type Role = "SUPERADMIN" | "ADMIN" | "PENGAWAS";

export const authorize = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Belum terautentikasi",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses",
      });
    }

    next();
  };
};