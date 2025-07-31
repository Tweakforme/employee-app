const nodemailer = require("nodemailer");
require("dotenv").config();

async function testEmail() {
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: "employee.hodder@gmail.com",
        subject: "Test Email",
        text: "This is a test email to check if SMTP works.",
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("? Test Email sent: " + info.response);
    } catch (error) {
        console.error("? Error sending email:", error);
    }
}

testEmail();
