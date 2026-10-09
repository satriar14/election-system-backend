import nodemailer from "nodemailer";

const emailUser = process.env.EMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD;

if (!emailUser || !emailPassword) {
  throw new Error("EMAIL_USER dan EMAIL_PASSWORD belum diset di .env");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPassword,
  },
});

export const sendInvitationEmail = async ({
  email,
  role,
  token,
}: {
  email: string;
  role: "ADMIN" | "PENGAWAS";
  token: string;
}) => {
  const frontendUrl =
    process.env.FRONTEND_URL;

  const invitationUrl =
    `${frontendUrl}/accept-invitation?token=${token}`;

  const roleName = role === "ADMIN" ? "Admin" : "Pengawas";

  await transporter.sendMail({
    from: `Pemilihan RT`,
    to: email,
    subject: `Invitation sebagai ${roleName} Pemilihan RT`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Invitation Web Voting</title>
        </head>

        <body style="
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
          font-family: Arial, sans-serif;
        ">
          <div style="
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 12px;
            padding: 40px;
          ">

            <h2 style="
              text-align: center;
              color: #333333;
            ">
              Invitation Pemilihan RT
            </h2>

            <p style="
              color: #555555;
              font-size: 16px;
            ">
              Halo,
            </p>

            <p style="
              color: #555555;
              font-size: 16px;
              line-height: 1.6;
            ">
              Anda mendapatkan invitation untuk bergabung sebagai
              <strong>${roleName}</strong>
              pada sistem Pemilihan RT.
            </p>

            <div style="
              text-align: center;
              margin: 30px 0;
            ">
              <a
                href="${invitationUrl}"
                style="
                  display: inline-block;
                  background-color: #7956DF;
                  color: #ffffff;
                  text-decoration: none;
                  padding: 14px 28px;
                  border-radius: 8px;
                  font-weight: bold;
                "
              >
                Terima Invitation
              </a>
            </div>

            <p style="
              color: #777777;
              font-size: 14px;
              line-height: 1.6;
            ">
              Link invitation ini berlaku selama 24 jam.
              Jika Anda tidak merasa menerima invitation ini,
              silakan abaikan email ini.
            </p>

            <hr style="
              border: none;
              border-top: 1px solid #eeeeee;
              margin: 30px 0;
            />

            <p style="
              text-align: center;
              color: #999999;
              font-size: 12px;
            ">
              Pemilihan RT
            </p>

          </div>
        </body>
      </html>
    `,
  });
};