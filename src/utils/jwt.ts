import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET belum diset di file .env");
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "PENGAWAS";
}

export const generateToken = (payload: JwtPayload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
};