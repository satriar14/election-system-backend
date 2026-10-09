import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendInvitationEmail } from "../services/email.service";
import { createAuditLog } from "../services/audit.service";

export const createInvitation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { email, role } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email dan role wajib diisi",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!["ADMIN", "PENGAWAS"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role hanya boleh ADMIN atau PENGAWAS",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Belum terautentikasi",
      });
    }

    // ADMIN hanya boleh mengundang PENGAWAS
    if (
      req.user.role === "ADMIN" &&
      role !== "PENGAWAS"
    ) {
      return res.status(403).json({
        success: false,
        message: "ADMIN hanya dapat mengundang PENGAWAS",
      });
    }

    // PENGAWAS tidak boleh mengundang
    if (req.user.role === "PENGAWAS") {
      return res.status(403).json({
        success: false,
        message: "PENGAWAS tidak dapat mengundang pengguna",
      });
    }

    // Cek apakah email sudah memiliki akun
    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "Email tersebut sudah terdaftar sebagai pengguna",
      });
    }

    // Cek invitation yang masih aktif
    const existingInvitation =
      await prisma.invitation.findFirst({
        where: {
          email: normalizedEmail,
          status: "PENDING",
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message:
          "Masih ada invitation yang aktif untuk email tersebut",
      });
    }

    // Generate token invitation
    const token = crypto.randomBytes(32).toString("hex");

    // Invitation berlaku selama 24 jam
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        role,
        token,
        expiresAt,
        invitedById: req.user.userId,
      },
    });

    try {
      // Kirim email invitation
      await sendInvitationEmail({
        email: invitation.email,
        role: invitation.role as "ADMIN" | "PENGAWAS",
        token: invitation.token,
      });
    } catch (emailError) {
      console.error(
        "SEND INVITATION EMAIL ERROR:",
        emailError
      );

      // Hapus invitation jika email gagal dikirim
      await prisma.invitation.delete({
        where: {
          id: invitation.id,
        },
      });

      return res.status(500).json({
        success: false,
        message:
          "Invitation gagal dikirim karena email tidak berhasil dikirim",
      });
    }

    await createAuditLog({
      userId: req.user.userId,
      action: "CREATE",
      entity: "INVITATION",
      entityId: invitation.id,
      details: `Mengirim invitation kepada ${invitation.email} dengan role ${invitation.role}`,
    });

    return res.status(201).json({
      success: true,
      message:
        "Invitation berhasil dibuat dan email berhasil dikirim",
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("CREATE INVITATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat atau mengirim invitation",
    });
  }
};

export const acceptInvitation = async (
  req: Request,
  res: Response
) => {
  try {
    const { token, name, password } = req.body || {};

    if (!token || !name || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Token, nama, dan password wajib diisi",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 8 karakter",
      });
    }

    const invitation = await prisma.invitation.findUnique({
      where: {
        token,
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation tidak ditemukan",
      });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message:
          "Invitation sudah tidak dapat digunakan",
      });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Invitation sudah expired",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: invitation.email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email tersebut sudah memiliki akun",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            name: name.trim(),
            email: invitation.email,
            password: hashedPassword,
            role: invitation.role,
            isActive: true,
          },
        });

        const updatedInvitation =
          await tx.invitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              status: "ACCEPTED",
              acceptedAt: new Date(),
            },
          });

        return {
          user,
          invitation: updatedInvitation,
        };
      }
    );

    // Karena accept invitation dilakukan tanpa login,
    // audit dicatat menggunakan user yang baru dibuat.
    await createAuditLog({
      userId: result.user.id,
      action: "ACCEPT",
      entity: "INVITATION",
      entityId: invitation.id,
      details: `Menerima invitation dan membuat akun sebagai ${result.user.role}`,
    });

    return res.status(201).json({
      success: true,
      message:
        "Invitation berhasil diterima. Akun berhasil dibuat.",
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
    });
  } catch (error) {
    console.error(
      "ACCEPT INVITATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};

export const getInvitation = async (
  req: Request,
  res: Response
) => {
  try {
    const token = req.params.token as string;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token invitation wajib diisi",
      });
    }

    const invitation = await prisma.invitation.findUnique({
      where: {
        token,
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation tidak ditemukan",
      });
    }

    // Kalau sudah expired
    if (
      invitation.status === "PENDING" &&
      invitation.expiresAt < new Date()
    ) {
      await prisma.invitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Invitation sudah expired",
      });
    }

    // Invitation sudah tidak bisa digunakan
    if (invitation.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message:
          "Invitation sudah tidak dapat digunakan",
      });
    }

    return res.json({
      success: true,
      message: "Invitation valid",
      data: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error(
      "GET INVITATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};