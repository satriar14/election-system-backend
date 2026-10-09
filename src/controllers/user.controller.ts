import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog } from "../services/audit.service";

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, search } = req.query;

    if (role === "WARGA") {
      // WARGA are stored in the House (DPT) table, not the User (pengurus) table
      return res.json({
        success: true,
        data: [],
      });
    }

    const whereCondition: any = {};

    if (role && typeof role === "string" && ["SUPERADMIN", "ADMIN", "PENGAWAS"].includes(role)) {
      whereCondition.role = role;
    }

    if (search && typeof search === "string") {
      whereCondition.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar pengguna",
    });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body || {};

    if (!role || !["SUPERADMIN", "ADMIN", "PENGAWAS"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role tidak valid. Pilihan: SUPERADMIN, ADMIN, PENGAWAS",
      });
    }

    if (!req.user || req.user.role !== "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        message: "Hanya SUPERADMIN yang dapat mengubah role pengguna",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await createAuditLog({
      userId: req.user.userId,
      action: "UPDATE",
      entity: "USER",
      entityId: id,
      details: `Mengubah role ${existingUser.name} (${existingUser.email}) dari ${existingUser.role} menjadi ${role}`,
    });

    return res.json({
      success: true,
      message: "Role pengguna berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE USER ROLE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui role pengguna",
    });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!req.user || !["SUPERADMIN", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !existingUser.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await createAuditLog({
      userId: req.user.userId,
      action: "UPDATE",
      entity: "USER",
      entityId: id,
      details: `${updatedUser.isActive ? "Mengaktifkan" : "Menonaktifkan"} akun ${existingUser.name} (${existingUser.email})`,
    });

    return res.json({
      success: true,
      message: `Status akun berhasil diubah menjadi ${updatedUser.isActive ? "Aktif" : "Non-Aktif"}`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("TOGGLE USER STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengubah status pengguna",
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!req.user || req.user.role !== "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        message: "Hanya SUPERADMIN yang dapat menghapus pengguna",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan",
      });
    }

    if (existingUser.id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "Anda tidak dapat menghapus akun Anda sendiri",
      });
    }

    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { userId: id },
      }),
      prisma.invitation.deleteMany({
        where: { invitedById: id },
      }),
      prisma.user.delete({
        where: { id },
      }),
    ]);

    await createAuditLog({
      userId: req.user.userId,
      action: "DELETE",
      entity: "USER",
      entityId: id,
      details: `Menghapus akun ${existingUser.name} (${existingUser.email})`,
    });

    return res.json({
      success: true,
      message: "Pengguna berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menghapus pengguna",
    });
  }
};
