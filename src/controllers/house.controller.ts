import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog } from "../services/audit.service";

export const getHouses = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const houses = await prisma.house.findMany({
      orderBy: [
        {
          block: "asc",
        },
        {
          houseNumber: "asc",
        },
      ],
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    const data = houses.map((house) => ({
      id: house.id,
      block: house.block,
      houseNumber: house.houseNumber,
      voterQuota: house.voterQuota,
      usedQuota: house._count.votes,
      remainingQuota: Math.max(
        house.voterQuota - house._count.votes,
        0
      ),
      createdAt: house.createdAt,
      updatedAt: house.updatedAt,
    }));

    return res.json({
      success: true,
      message: "Data rumah berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET HOUSES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data rumah",
    });
  }
};

export const getHouseById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const house = await prisma.house.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Data rumah tidak ditemukan",
      });
    }

    const usedQuota = house._count.votes;

    return res.json({
      success: true,
      message: "Data rumah berhasil diambil",
      data: {
        id: house.id,
        block: house.block,
        houseNumber: house.houseNumber,
        voterQuota: house.voterQuota,
        usedQuota,
        remainingQuota: Math.max(
          house.voterQuota - usedQuota,
          0
        ),
        createdAt: house.createdAt,
        updatedAt: house.updatedAt,
      },
    });
  } catch (error) {
    console.error("GET HOUSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data rumah",
    });
  }
};

export const createHouse = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { block, houseNumber, voterQuota } = req.body || {};

    if (!block || !houseNumber || voterQuota === undefined) {
      return res.status(400).json({
        success: false,
        message: "Block, nomor rumah, dan kuota wajib diisi",
      });
    }

    const normalizedBlock = String(block).trim().toUpperCase();
    const normalizedHouseNumber = String(houseNumber).trim();
    const quota = Number(voterQuota);

    if (!normalizedBlock || !normalizedHouseNumber) {
      return res.status(400).json({
        success: false,
        message: "Block dan nomor rumah tidak boleh kosong",
      });
    }

    if (!Number.isInteger(quota) || quota < 1) {
      return res.status(400).json({
        success: false,
        message: "Kuota hak pilih harus berupa bilangan bulat minimal 1",
      });
    }

    const existingHouse = await prisma.house.findUnique({
      where: {
        block_houseNumber: {
          block: normalizedBlock,
          houseNumber: normalizedHouseNumber,
        },
      },
    });

    if (existingHouse) {
      return res.status(400).json({
        success: false,
        message: "Rumah dengan block dan nomor tersebut sudah terdaftar",
      });
    }

    const house = await prisma.house.create({
      data: {
        block: normalizedBlock,
        houseNumber: normalizedHouseNumber,
        voterQuota: quota,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "CREATE",
      entity: "HOUSE",
      entityId: house.id,
      details: `Membuat rumah ${house.block}-${house.houseNumber} dengan kuota ${house.voterQuota}`,
    });

    return res.status(201).json({
      success: true,
      message: "Data rumah berhasil ditambahkan",
      data: {
        id: house.id,
        block: house.block,
        houseNumber: house.houseNumber,
        voterQuota: house.voterQuota,
        usedQuota: 0,
        remainingQuota: house.voterQuota,
      },
    });
  } catch (error) {
    console.error("CREATE HOUSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan data rumah",
    });
  }
};

export const updateHouse = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const { block, houseNumber, voterQuota } = req.body || {};

    const existingHouse = await prisma.house.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!existingHouse) {
      return res.status(404).json({
        success: false,
        message: "Data rumah tidak ditemukan",
      });
    }

    const usedQuota = existingHouse._count.votes;

    const normalizedBlock =
      block !== undefined
        ? String(block).trim().toUpperCase()
        : existingHouse.block;

    const normalizedHouseNumber =
      houseNumber !== undefined
        ? String(houseNumber).trim()
        : existingHouse.houseNumber;

    const quota =
      voterQuota !== undefined
        ? Number(voterQuota)
        : existingHouse.voterQuota;

    if (!normalizedBlock || !normalizedHouseNumber) {
      return res.status(400).json({
        success: false,
        message: "Block dan nomor rumah tidak boleh kosong",
      });
    }

    if (!Number.isInteger(quota) || quota < 1) {
      return res.status(400).json({
        success: false,
        message: "Kuota hak pilih harus berupa bilangan bulat minimal 1",
      });
    }

    if (quota < usedQuota) {
      return res.status(400).json({
        success: false,
        message: `Kuota tidak boleh lebih kecil dari jumlah suara yang sudah digunakan (${usedQuota})`,
      });
    }

    const duplicateHouse = await prisma.house.findFirst({
      where: {
        block: normalizedBlock,
        houseNumber: normalizedHouseNumber,
        NOT: {
          id,
        },
      },
    });

    if (duplicateHouse) {
      return res.status(400).json({
        success: false,
        message: "Rumah dengan block dan nomor tersebut sudah terdaftar",
      });
    }

    const house = await prisma.house.update({
      where: {
        id,
      },
      data: {
        block: normalizedBlock,
        houseNumber: normalizedHouseNumber,
        voterQuota: quota,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "UPDATE",
      entity: "HOUSE",
      entityId: house.id,
      details: `Memperbarui rumah ${house.block}-${house.houseNumber} dengan kuota ${house.voterQuota}`,
    });

    return res.json({
      success: true,
      message: "Data rumah berhasil diperbarui",
      data: {
        id: house.id,
        block: house.block,
        houseNumber: house.houseNumber,
        voterQuota: house.voterQuota,
        usedQuota,
        remainingQuota: Math.max(
          house.voterQuota - usedQuota,
          0
        ),
      },
    });
  } catch (error) {
    console.error("UPDATE HOUSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data rumah",
    });
  }
};

export const deleteHouse = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const house = await prisma.house.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Data rumah tidak ditemukan",
      });
    }

    if (house._count.votes > 0) {
      return res.status(400).json({
        success: false,
        message: "Rumah yang sudah memiliki suara tidak dapat dihapus",
      });
    }

    await prisma.house.delete({
      where: {
        id,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "DELETE",
      entity: "HOUSE",
      entityId: house.id,
      details: `Menghapus rumah ${house.block}-${house.houseNumber}`,
    });

    return res.json({
      success: true,
      message: "Data rumah berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE HOUSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus data rumah",
    });
  }
};