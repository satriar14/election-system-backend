import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAuditLogs = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: "Data audit log berhasil diambil",
      data: logs,
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data audit log",
    });
  }
};

export const getAuditLogById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const log = await prisma.auditLog.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail audit log berhasil diambil",
      data: log,
    });
  } catch (error) {
    console.error("GET AUDIT LOG ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil detail audit log",
    });
  }
};