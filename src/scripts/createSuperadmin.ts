import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

const createSuperadmin = async () => {
  try {
    const email = "superadmin@mail.com";
    const password = "password";
    const name = "Super Admin";

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      console.log("SUPERADMIN sudah ada.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "SUPERADMIN",
        isActive: true,
      },
    });

    console.log("=================================");
    console.log("SUPERADMIN berhasil dibuat!");
    console.log("=================================");
    console.log("ID       :", user.id);
    console.log("Nama     :", user.name);
    console.log("Email    :", user.email);
    console.log("Password :", password);
    console.log("Role     :", user.role);
    console.log("=================================");
  } catch (error) {
    console.error("Gagal membuat SUPERADMIN:", error);
  } finally {
    await prisma.$disconnect();
  }
};

createSuperadmin();